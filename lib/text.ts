import type { Sentence, WordToken } from "./types";

const WORD_RE = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g;
const TOKEN_RE = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*|[^\sA-Za-z0-9]+/g;
const STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "and", "or", "but", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that",
  "these", "those", "i", "you", "we", "they", "he", "she", "my", "your", "our",
  "their", "as", "by", "from", "so", "do", "does", "did", "not", "no", "never",
  "can", "could", "will", "would", "should", "may", "might", "must", "have",
  "has", "had", "there", "here", "if", "than", "then", "too", "very", "just",
  "about", "into", "over", "after", "before", "up", "down", "out", "off",
  "most", "much", "many", "some", "any", "all", "each", "every", "own", "same",
]);

export function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
}

export function normalizePhrase(value: string): string {
  return extractWords(value).join(" ");
}

export function normalizeAnswer(value: string): string {
  return extractWords(value).join(" ");
}

export function extractWords(value: string): string[] {
  return (value.toLowerCase().replace(/[’‘]/g, "'").match(WORD_RE) ?? []).map((word) =>
    word.replace(/^'+|'+$/g, ""),
  );
}

export function isContentWord(word: string): boolean {
  const normalized = normalizeWord(word);
  return normalized.length >= 4 && !STOPWORDS.has(normalized);
}

export function tokenizeSentence(text: string, sentenceIndex = 0): WordToken[] {
  const matches = Array.from(text.matchAll(TOKEN_RE));
  const tokens: WordToken[] = [];
  let pending = "";

  for (const match of matches) {
    const piece = match[0];
    if (/^[A-Za-z0-9]/.test(piece)) {
      tokens.push({
        id: `s${sentenceIndex + 1}-w${tokens.length + 1}`,
        text: piece,
        display: pending + piece,
        prefix: pending,
        suffix: "",
        start: 0,
        end: 0,
      });
      pending = "";
    } else if (tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      last.suffix = `${last.suffix ?? ""}${piece}`;
      last.display = `${last.display}${piece}`;
    } else {
      pending += piece;
    }
  }

  return tokens;
}

const HARD_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "gen", "gov", "sen", "rep",
  "capt", "lt", "sgt", "rev", "hon", "pres", "u.s", "u.k",
]);
const SOFT_ABBREVIATIONS = new Set([
  "e.g", "i.e", "etc", "a.m", "p.m", "fig", "dept", "approx", "inc", "ltd", "co", "mt", "no",
]);

type AbbreviationKind = "hard" | "soft" | null;

function abbreviationBeforeDot(text: string, dotIndex: number): AbbreviationKind {
  const before = text.slice(0, dotIndex);
  const token = before.match(/([A-Za-z.]+)$/)?.[1].toLowerCase() ?? "";
  if (!token) return null;
  if (token === "i") return null;
  if (HARD_ABBREVIATIONS.has(token) || /^[a-z]$/.test(token)) return "hard";
  if (SOFT_ABBREVIATIONS.has(token)) return "soft";
  return null;
}

function nextStartsSentence(text: string, punctuationIndex: number): boolean {
  const after = text
    .slice(punctuationIndex + 1)
    .replace(/^["'”’)\]]+/, "")
    .trimStart();
  return !after || /^[A-Z0-9“"']/.test(after);
}

/**
 * Split on real sentence terminals, not on abbreviations, initials, or
 * decimal points. Subtitles often carry "Dr." or "e.g." in the middle of a
 * line; those must not become separate dictation items.
 */
export function splitIntoSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    if (!".!?…".includes(character)) continue;

    if (character === ".") {
      const previous = clean[index - 1] ?? "";
      const next = clean[index + 1] ?? "";
      if (/\d/.test(previous) && /\d/.test(next)) continue; // 3.14
      if (next === ".") continue; // wait for the last dot of an ellipsis
      const abbreviation = abbreviationBeforeDot(clean, index);
      if (abbreviation === "hard") continue;
      if (abbreviation === "soft" && !nextStartsSentence(clean, index)) continue;
    }

    let end = index + 1;
    while (end < clean.length && /["'”’)\]]/.test(clean[end])) end += 1;
    // A period inside a word (URL, filename, U.S) is not a boundary.
    if (end < clean.length && clean[end] !== " ") continue;

    const part = clean.slice(start, end).trim();
    if (part) parts.push(part);
    start = end;
    while (start < clean.length && clean[start] === " ") start += 1;
    index = start - 1;
  }

  if (start < clean.length) {
    const tail = clean.slice(start).trim();
    if (tail) parts.push(tail);
  }
  return parts;
}

export function endsSentence(text: string): boolean {
  const trimmed = text.trim();
  const match = trimmed.match(/[.!?…]["'”’)\]]*$/);
  if (!match) return false;
  if (match[0].startsWith(".")) {
    const dot = trimmed.lastIndexOf(".");
    if (dot >= 0 && abbreviationBeforeDot(trimmed, dot) === "hard") return false;
  }
  return true;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function stripSubtitleMarkup(value: string): string {
  return value
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatTime(seconds: number, withHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (withHours || hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return formatTime(seconds);
}

export function sentenceAtTime(sentences: Sentence[], time: number): Sentence | undefined {
  if (!sentences.length) return undefined;
  let previous = sentences[0];
  for (const sentence of sentences) {
    if (time < sentence.start) return previous;
    if (time <= sentence.end + 0.12) return sentence;
    previous = sentence;
  }
  return previous;
}

export function sentenceIndexAtTime(sentences: Sentence[], time: number): number {
  const found = sentenceAtTime(sentences, time);
  return found ? found.index : 0;
}

export function activeWordIndex(sentence: Sentence | undefined, time: number): number {
  if (!sentence) return -1;
  for (let index = 0; index < sentence.words.length; index += 1) {
    const word = sentence.words[index];
    if (time >= word.start && time < word.end) return index;
  }
  if (time >= sentence.end) return sentence.words.length - 1;
  return -1;
}

export function findPhraseTokens(sentence: Sentence, phrase: string): WordToken[] {
  const target = extractWords(phrase);
  if (!target.length) return [];
  const words = sentence.words.map((word) => normalizeWord(word.text));
  for (let start = 0; start <= words.length - target.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < target.length; offset += 1) {
      if (words[start + offset] !== target[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return sentence.words.slice(start, start + target.length);
  }
  return [];
}

export function maskSentence(sentence: Sentence, startWord: number, endWord: number): string {
  return sentence.words
    .map((word, index) => {
      if (index >= startWord && index <= endWord) return "_____";
      return word.display;
    })
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1");
}

export function findTokenIndex(sentence: Sentence, token: WordToken): number {
  return sentence.words.findIndex((candidate) => candidate.id === token.id);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

export type DiffPart = { type: "same" | "missing" | "extra"; text: string };

export function diffWords(expected: string, actual: string): DiffPart[] {
  const left = extractWords(expected);
  const right = extractWords(actual);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      table[i][j] =
        left[i - 1] === right[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      parts.push({ type: "same", text: left[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      parts.push({ type: "extra", text: right[j - 1] });
      j -= 1;
    } else if (i > 0) {
      parts.push({ type: "missing", text: left[i - 1] });
      i -= 1;
    }
  }
  return parts.reverse();
}


export type CompareWordPart = { text: string; status: "same" | "missing" | "extra" };
export type WordComparison = {
  expected: CompareWordPart[];
  actual: CompareWordPart[];
  missing: string[];
  extra: string[];
};

/**
 * Word-level alignment for feedback: keep the correct sentence readable while
 * marking words that are missing from the attempt or extra/wrong in it.
 */
export function compareWords(expected: string, actual: string): WordComparison {
  const left = extractWords(expected);
  const right = extractWords(actual);
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array(right.length + 1).fill(0),
  );
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      table[i][j] =
        left[i - 1] === right[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const operations: CompareWordPart[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      operations.push({ text: left[i - 1], status: "same" });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      operations.push({ text: right[j - 1], status: "extra" });
      j -= 1;
    } else if (i > 0) {
      operations.push({ text: left[i - 1], status: "missing" });
      i -= 1;
    }
  }
  operations.reverse();

  const expectedParts: CompareWordPart[] = [];
  const actualParts: CompareWordPart[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  for (const operation of operations) {
    if (operation.status === "same") {
      expectedParts.push(operation);
      actualParts.push(operation);
    } else if (operation.status === "missing") {
      expectedParts.push(operation);
      missing.push(operation.text);
    } else {
      actualParts.push(operation);
      extra.push(operation.text);
    }
  }
  return { expected: expectedParts, actual: actualParts, missing, extra };
}

export function scoreAnswer(expected: string, actual: string, mode: "word" | "phrase" | "sentence"): number {
  const target = mode === "word" ? normalizeWord(expected) : normalizeAnswer(expected);
  const value = mode === "word" ? normalizeWord(actual) : normalizeAnswer(actual);
  if (!value) return 0;
  if (target === value) return 1;
  if (mode === "word") {
    return Math.max(0, 1 - levenshtein(target, value) / Math.max(target.length, value.length));
  }
  // Longest common subsequence keeps word order meaningful: "progress real"
  // must not score as a perfect match for "real progress".
  const targetWords = target.split(" ").filter(Boolean);
  const valueWords = value.split(" ").filter(Boolean);
  const table: number[][] = Array.from({ length: targetWords.length + 1 }, () =>
    new Array(valueWords.length + 1).fill(0),
  );
  for (let i = 1; i <= targetWords.length; i += 1) {
    for (let j = 1; j <= valueWords.length; j += 1) {
      table[i][j] =
        targetWords[i - 1] === valueWords[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  const matches = table[targetWords.length][valueWords.length];
  return matches / Math.max(targetWords.length, valueWords.length);
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function shuffled<T>(items: T[], seed = 1): T[] {
  const result = [...items];
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
