import type { Lesson, Sentence, WordToken } from "./types";
import {
  endsSentence,
  hashString,
  normalizePhrase,
  splitIntoSentences,
  stripSubtitleMarkup,
  tokenizeSentence,
} from "./text";

export type SubtitleCue = {
  id: number;
  start: number;
  end: number;
  text: string;
};

const TIMESTAMP_LINE = /((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3})/;

export function parseTimestamp(value: string): number {
  const clean = value.trim().replace(",", ".");
  const pieces = clean.split(":").map(Number);
  if (pieces.some((piece) => Number.isNaN(piece))) return Number.NaN;
  if (pieces.length === 3) return pieces[0] * 3600 + pieces[1] * 60 + pieces[2];
  if (pieces.length === 2) return pieces[0] * 60 + pieces[1];
  return pieces[0] ?? Number.NaN;
}

function isMetadataLine(line: string): boolean {
  return /^(WEBVTT|NOTE\b|STYLE\b|REGION\b|Kind:|Language:|X-TIMESTAMP-MAP)/i.test(line.trim());
}

export function parseSubtitle(raw: string): SubtitleCue[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let blocks = text.split(/\n{2,}/);

  // Some exporters omit blank lines. Recover cues by splitting on timestamps.
  if (!blocks.some((block) => TIMESTAMP_LINE.test(block)) && TIMESTAMP_LINE.test(text)) {
    blocks = text.split(/(?=\n?\d+\s*\n(?=\d{1,2}:))/g);
  }

  const cues: SubtitleCue[] = [];
  let index = 0;
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timestampIndex = lines.findIndex((line) => TIMESTAMP_LINE.test(line));
    if (timestampIndex < 0) continue;
    const match = lines[timestampIndex].match(TIMESTAMP_LINE);
    if (!match) continue;
    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const body = lines
      .slice(timestampIndex + 1)
      .filter((line) => !isMetadataLine(line))
      .join(" ")
      .trim();
    const cleaned = stripSubtitleMarkup(body);
    if (!cleaned) continue;

    // Skip duplicate rolling captions, common in auto-generated VTT.
    const previous = cues[cues.length - 1];
    if (previous && previous.text === cleaned && Math.abs(previous.start - start) < 0.25) {
      previous.end = Math.max(previous.end, end);
      continue;
    }

    cues.push({ id: index, start, end, text: cleaned });
    index += 1;
  }

  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < cues.length - 1; i += 1) {
    if (cues[i].end > cues[i + 1].start) cues[i].end = cues[i + 1].start;
  }
  return cues.filter((cue) => cue.end > cue.start);
}

function tokenWeight(token: WordToken): number {
  let weight = Math.max(2, token.text.length * 1.05 + 1);
  if (/[,;:]$/.test(token.suffix ?? "")) weight += 1.1;
  if (/[.!?…]$/.test(token.suffix ?? "")) weight += 1.7;
  return weight;
}

export function estimateWordTimings(tokens: WordToken[], start: number, end: number): WordToken[] {
  if (!tokens.length) return tokens;
  const duration = Math.max(0.12, end - start);
  const weights = tokens.map(tokenWeight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = start;
  return tokens.map((token, index) => {
    const span = (duration * weights[index]) / total;
    const next = index === tokens.length - 1 ? end : cursor + span;
    const timed = { ...token, start: Number(cursor.toFixed(3)), end: Number(next.toFixed(3)) };
    cursor = next;
    return timed;
  });
}

type TimedFragment = {
  text: string;
  start: number;
  end: number;
  tokens: WordToken[];
};

function shouldMergeFragments(current: TimedFragment, next: TimedFragment): boolean {
  const currentText = current.text.trim();
  if (!currentText) return true;
  if (endsSentence(currentText)) return false;

  const nextText = next.text.trim();
  if (!nextText) return true;

  const gap = Math.max(0, next.start - current.end);
  const combinedWords = current.tokens.length + next.tokens.length;
  if (current.tokens.length >= 36 || combinedWords > 48 || next.end - current.start > 28) {
    return false;
  }

  // A zero/short gap almost always means the caption was split at a line
  // boundary, not at a sentence boundary.
  if (gap <= 0.45) return true;

  // A comma/colon/dash at the end is an explicit continuation signal.
  if (/[,;:—–-]$/.test(currentText)) return true;

  // Lowercase continuations are nearly always the same sentence.
  if (/^[a-z]/.test(nextText)) return true;

  // Longer pauses with an uppercase start are likely a new sentence when the
  // previous fragment was already substantial.
  if (gap <= 1.1 && current.tokens.length <= 24) return true;
  return false;
}

function mergeFragments(current: TimedFragment, next: TimedFragment): TimedFragment {
  const trimmed = current.text.trim();
  const separator = trimmed.endsWith("-") ? "" : " ";
  return {
    text: `${trimmed}${separator}${next.text.trim()}`.replace(/\s+/g, " ").trim(),
    start: current.start,
    end: next.end,
    tokens: [...current.tokens, ...next.tokens],
  };
}

export type SubtitleBuildInput = {
  title: string;
  subtitleText: string;
  subtitleName?: string;
  videoSrc: string;
  poster?: string;
  duration?: number;
};

export function buildLessonFromSubtitle(input: SubtitleBuildInput): Lesson {
  const cues = parseSubtitle(input.subtitleText);
  if (!cues.length) {
    throw new Error("没有解析到有效字幕。请确认文件是 SRT 或 VTT 格式。");
  }

  // First turn each cue into timed sentence fragments. A fragment can span
  // several cues; that is the crucial difference from treating every SRT cue
  // as one dictation sentence.
  const fragments: TimedFragment[] = [];
  for (const cue of cues) {
    const parts = splitIntoSentences(cue.text);
    if (!parts.length) continue;
    const totalChars = parts.reduce((sum, part) => sum + part.length, 0) || 1;
    let cursor = cue.start;
    for (const part of parts) {
      const span = (cue.end - cue.start) * (part.length / totalChars);
      const sentenceEnd = Math.min(cue.end, cursor + span);
      const tokens = tokenizeSentence(part);
      const timed = estimateWordTimings(tokens, cursor, sentenceEnd);
      if (timed.length) {
        fragments.push({
          text: part,
          start: timed[0].start,
          end: timed[timed.length - 1].end,
          tokens: timed,
        });
      }
      cursor = sentenceEnd;
    }
  }

  const merged: TimedFragment[] = [];
  let current: TimedFragment | null = null;
  for (const fragment of fragments) {
    if (!current) {
      current = fragment;
      continue;
    }
    if (shouldMergeFragments(current, fragment)) {
      current = mergeFragments(current, fragment);
    } else {
      merged.push(current);
      current = fragment;
    }
  }
  if (current) merged.push(current);

  const sentences: Sentence[] = merged.map((fragment, index) => {
    const words = fragment.tokens.map((token, wordIndex) => ({
      ...token,
      id: `s${index + 1}-w${wordIndex + 1}`,
    }));
    return {
      id: `s${index + 1}`,
      index,
      text: fragment.text.replace(/\s+/g, " ").trim(),
      start: words[0].start,
      end: words[words.length - 1].end,
      words,
    };
  });

  if (!sentences.length) {
    throw new Error("字幕内容为空，无法建立学习条目。");
  }

  const lastEnd = sentences[sentences.length - 1].end;
  const title = input.title.trim() || input.subtitleName?.replace(/\.(srt|vtt)$/i, "") || "Imported lesson";
  const fingerprint = hashString(`${title}:${input.subtitleText.slice(0, 500)}`);
  return {
    id: `import-${fingerprint}`,
    title,
    subtitle: "Your own video, with subtitles you control.",
    speaker: "Local import",
    accent: "Local import",
    level: "Custom",
    duration: Math.max(input.duration ?? 0, lastEnd),
    videoSrc: input.videoSrc,
    poster: input.poster,
    sourceNote: "Local video + SRT/VTT import. Word timings are estimated from subtitle cue boundaries.",
    alignment: "estimated",
    tags: ["Imported", `${cues.length} cues`],
    sentences,
    imported: true,
    subtitleName: input.subtitleName,
  };
}

export function lessonToSrt(lesson: Lesson): string {
  const timestamp = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    const millis = ms % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
  };
  return lesson.sentences
    .map(
      (sentence, index) =>
        `${index + 1}\n${timestamp(sentence.start)} --> ${timestamp(sentence.end)}\n${sentence.text}\n`,
    )
    .join("\n");
}

export function detectPhraseCandidates(lesson: Lesson): string[] {
  const candidates = new Set<string>();
  for (const phrase of lesson.focusPhrases ?? []) {
    if (normalizePhrase(phrase.text).split(" ").length >= 2) candidates.add(phrase.text);
  }
  return Array.from(candidates);
}
