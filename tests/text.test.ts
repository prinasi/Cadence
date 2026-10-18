import { describe, expect, it } from "vitest";
import {
  activeWordIndex,
  compareWords,
  diffWords,
  extractWords,
  maskSentence,
  normalizeAnswer,
  normalizePhrase,
  normalizeWord,
  scoreAnswer,
  sentenceAtTime,
  splitIntoSentences,
  tokenizeSentence,
} from "@/lib/text";
import { buildLessonFromSubtitle, estimateWordTimings, parseSubtitle, parseTimestamp } from "@/lib/subtitles";
import { demoLesson } from "@/lib/demo";
import { buildSession, availableModes, wordExercise } from "@/lib/exercises";

describe("text normalization", () => {
  it("normalizes punctuation, curly apostrophes and case", () => {
    expect(normalizeWord("Progress,")).toBe("progress");
    expect(normalizeWord("DON’T")).toBe("don't");
    expect(normalizeAnswer("  Figure   it out! ")).toBe("figure it out");
    expect(normalizePhrase("day   after day")).toBe("day after day");
  });

  it("extracts words without punctuation", () => {
    expect(extractWords("A short walk, after lunch.")).toEqual(["a", "short", "walk", "after", "lunch"]);
  });

  it("tokenizes with display punctuation and stable ids", () => {
    const tokens = tokenizeSentence("It’s a test, isn’t it?", 2);
    expect(tokens.map((token) => token.display)).toEqual(["It’s", "a", "test,", "isn’t", "it?"]);
    expect(tokens[0].id).toBe("s3-w1");
    expect(tokens[2].suffix).toBe(",");
  });

  it("splits sentences without losing terminal punctuation", () => {
    expect(splitIntoSentences("First line. Second line! A third?")).toEqual([
      "First line.",
      "Second line!",
      "A third?",
    ]);
  });

  it("does not split titles, abbreviations, initials, or decimals", () => {
    expect(splitIntoSentences("Dr. Smith arrived at 3.14 p.m. He waited.")).toEqual([
      "Dr. Smith arrived at 3.14 p.m.",
      "He waited.",
    ]);
    expect(splitIntoSentences("This is e.g. a test. Next one.")).toEqual([
      "This is e.g. a test.",
      "Next one.",
    ]);
    expect(splitIntoSentences("J. K. Rowling wrote it.")).toEqual(["J. K. Rowling wrote it."]);
  });

  it("aligns expected and actual words for red feedback and detects typos", () => {
    const comparison = compareWords("Most of us wait for progress.", "Most of us wait for progres");
    expect(comparison.actual.some((part) => part.status === "extra" && part.text === "progres")).toBe(true);
    expect(comparison.missing).toContain("progress");
    expect(comparison.expected.some((part) => part.status === "missing" && part.text === "progress")).toBe(true);
    const typoPart = comparison.actual.find((part) => part.text === "progres");
    expect(typoPart?.typo).toBe(true);
    expect(typoPart?.typoFor).toBe("progress");
  });

  it("finds the active word and sentence", () => {
    const sentence = demoLesson.sentences[0];
    expect(sentenceAtTime(demoLesson.sentences, 1.0)?.id).toBe("s1");
    expect(sentenceAtTime(demoLesson.sentences, 3.2)?.id).toBe("s1");
    expect(sentenceAtTime(demoLesson.sentences, 40.5)?.id).toBe("s10");
    expect(activeWordIndex(sentence, 1.0)).toBeGreaterThanOrEqual(0);
    expect(activeWordIndex(sentence, 30)).toBe(sentence.words.length - 1);
  });

  it("masks only the target word in context", () => {
    const sentence = demoLesson.sentences[1];
    const index = sentence.words.findIndex((token) => token.text === "progress");
    expect(maskSentence(sentence, index, index)).toContain("_____");
    expect(maskSentence(sentence, index, index)).not.toContain("progress");
  });
});

describe("answer scoring", () => {
  it("ignores punctuation and extra whitespace", () => {
    expect(scoreAnswer("Most of us wait.", "most   of us wait", "sentence")).toBe(1);
  });

  it("recognizes common contractions as equivalent", () => {
    expect(scoreAnswer("I don't think so.", "I do not think so", "sentence")).toBe(1);
    expect(scoreAnswer("It's a great habit.", "it is a great habit", "sentence")).toBe(1);
  });

  it("scores near-miss words char by char", () => {
    expect(scoreAnswer("progress", "progres", "word")).toBeGreaterThan(0.8);
    expect(scoreAnswer("progress", "", "word")).toBe(0);
    expect(scoreAnswer("real progress", "progress real", "phrase")).toBe(0.5);
  });

  it("reports missing and extra words in a diff", () => {
    const diff = diffWords("a short walk after lunch", "a short run after lunch");
    expect(diff.some((part) => part.type === "missing" && part.text === "walk")).toBe(true);
    expect(diff.some((part) => part.type === "extra" && part.text === "run")).toBe(true);
  });
});

describe("subtitle parsing", () => {
  it("parses SRT timestamps and multiline cues", () => {
    const raw = `1\n00:00:01,250 --> 00:00:03,500\nHello\nworld.\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond line.`;
    const cues = parseSubtitle(raw);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(1.25);
    expect(cues[0].text).toBe("Hello world.");
    expect(cues[1].end).toBe(6);
  });

  it("parses VTT settings, tags and short timestamps", () => {
    const raw = `WEBVTT\n\n00:00.000 --> 00:02.000 align:start position:0%\n<v Teacher>Hello <c>there</c>.</v>\n\n00:02.000 --> 00:04.500\nA second cue.`;
    const cues = parseSubtitle(raw);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("Hello there.");
    expect(parseTimestamp("01:02.500")).toBe(62.5);
  });

  it("joins a sentence that spans multiple subtitle cues", () => {
    const raw = `1
00:00:01,000 --> 00:00:02,000
Most of us wait for a big

2
00:00:02,050 --> 00:00:03,500
moment to change our lives.

3
00:00:04,000 --> 00:00:05,000
But real progress rarely

4
00:00:05,100 --> 00:00:07,000
arrives in a single leap.`;
    const lesson = buildLessonFromSubtitle({ title: "Joined cues", subtitleText: raw, videoSrc: "blob:x" });
    expect(lesson.sentences.map((sentence) => sentence.text)).toEqual([
      "Most of us wait for a big moment to change our lives.",
      "But real progress rarely arrives in a single leap.",
    ]);
    expect(lesson.sentences[0].words.map((word) => word.start)).toEqual(
      [...lesson.sentences[0].words.map((word) => word.start)].sort((a, b) => a - b),
    );
    expect(lesson.sentences[0].end).toBeLessThan(4);
  });

  it("builds sentence-level word timings from cue boundaries", () => {
    const raw = `1\n00:00:01,000 --> 00:00:05,000\nOne small step. Then another.`;
    const lesson = buildLessonFromSubtitle({
      title: "Test lesson",
      subtitleText: raw,
      videoSrc: "blob:test",
    });
    expect(lesson.sentences).toHaveLength(2);
    expect(lesson.alignment).toBe("estimated");
    expect(lesson.sentences[0].start).toBeGreaterThanOrEqual(1);
    expect(lesson.sentences[0].end).toBeLessThanOrEqual(5.001);
    for (const sentence of lesson.sentences) {
      for (let index = 1; index < sentence.words.length; index += 1) {
        expect(sentence.words[index].start).toBeGreaterThanOrEqual(sentence.words[index - 1].end - 0.001);
      }
    }
  });

  it("keeps estimated timings monotonic and inside the cue", () => {
    const tokens = tokenizeSentence("A page read before bed becomes a finished book.");
    const timed = estimateWordTimings(tokens, 10, 13);
    expect(timed[0].start).toBe(10);
    expect(timed[timed.length - 1].end).toBe(13);
    expect(timed.every((token) => token.end > token.start)).toBe(true);
  });

  it("rejects empty subtitle content", () => {
    expect(() =>
      buildLessonFromSubtitle({ title: "Empty", subtitleText: "not a subtitle", videoSrc: "blob:x" }),
    ).toThrow();
  });
});

describe("exercise generation", () => {
  it("finds the available practice modes", () => {
    const modes = availableModes(demoLesson, []);
    expect(modes.word).toBeGreaterThan(0);
    expect(modes.phrase).toBeGreaterThan(0);
    expect(modes.sentence).toBe(10);
  });

  it("builds valid word, phrase and sentence rounds", () => {
    for (const [mode, count] of [
      ["word", 5],
      ["phrase", 4],
      ["sentence", 3],
    ] as const) {
      const exercises = buildSession(demoLesson, mode, count);
      expect(exercises).toHaveLength(count);
      for (const exercise of exercises) {
        expect(exercise.start).toBeLessThan(exercise.end);
        expect(exercise.answer.length).toBeGreaterThan(0);
        expect(exercise.contextLine.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps sentence dictation in lesson order", () => {
    const exercises = buildSession(demoLesson, "sentence", 4);
    expect(exercises.map((exercise) => exercise.sentence.id)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("can begin a sentence round at a chosen line", () => {
    const exercises = buildSession(demoLesson, "sentence", 3, [], 1, 5);
    expect(exercises.map((exercise) => exercise.sentence.index)).toEqual([5, 6, 7]);
    expect(exercises[0].answer).toBe(demoLesson.sentences[5].text);
  });

  it("creates a word exercise with a masked context line", () => {
    const sentence = demoLesson.sentences[1];
    const token = sentence.words.find((word) => word.text === "progress")!;
    const exercise = wordExercise(sentence, token);
    expect(exercise.answer).toBe("progress");
    expect(exercise.contextLine).toContain("_____");
    expect(exercise.contextLine).not.toContain("progress");
  });

  it("prioritizes saved notebook words in word practice rounds", () => {
    const s2 = demoLesson.sentences[1];
    const savedItem = {
      id: "word-s2-progress",
      type: "word" as const,
      text: "progress",
      normalized: "progress",
      createdAt: new Date().toISOString(),
      practice: { attempts: 2, correct: 0 },
      context: {
        lessonId: demoLesson.id,
        lessonTitle: demoLesson.title,
        sentenceId: s2.id,
        sentence: s2.text,
        start: s2.start,
        end: s2.end,
      },
    };
    const exercises = buildSession(demoLesson, "word", 3, [savedItem], 1);
    expect(exercises.some((ex) => ex.answer === "progress")).toBe(true);
    expect(exercises[0].answer).toBe("progress");
  });
});
