import type { Exercise, ExerciseMode, Lesson, LearningItem, Sentence, WordToken } from "./types";
import { findPhraseTokens, isContentWord, maskSentence, normalizeWord, shuffled } from "./text";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function wordExercise(sentence: Sentence, token: WordToken): Exercise {
  const wordIndex = sentence.words.findIndex((item) => item.id === token.id);
  const answer = token.text;
  const clean = normalizeWord(answer);
  return {
    id: `word-${sentence.id}-${token.id}`,
    mode: "word",
    answer,
    sentence,
    start: Math.max(0, token.start - 0.18),
    end: Math.min(sentence.end + 0.5, token.end + 0.22),
    wordStart: wordIndex,
    wordEnd: wordIndex,
    contextLine: maskSentence(sentence, wordIndex, wordIndex),
    translation: sentence.translation,
    hint: `Starts with “${answer.charAt(0)}” · ${clean.length} letters`,
    savedText: answer,
  };
}

export function phraseExercise(
  sentence: Sentence,
  tokens: WordToken[],
  translation?: string,
): Exercise {
  const startIndex = sentence.words.findIndex((item) => item.id === tokens[0]?.id);
  const endIndex = sentence.words.findIndex((item) => item.id === tokens[tokens.length - 1]?.id);
  const answer = tokens.map((token) => token.text).join(" ");
  return {
    id: `phrase-${sentence.id}-${tokens[0]?.id}-${tokens[tokens.length - 1]?.id}`,
    mode: "phrase",
    answer,
    sentence,
    start: Math.max(0, (tokens[0]?.start ?? sentence.start) - 0.14),
    end: Math.min(sentence.end + 0.5, (tokens[tokens.length - 1]?.end ?? sentence.end) + 0.24),
    wordStart: startIndex,
    wordEnd: endIndex,
    contextLine: maskSentence(sentence, startIndex, endIndex),
    translation: translation ?? sentence.translation,
    hint: `${tokens.length} words · starts with “${tokens[0]?.text ?? ""}”`,
    savedText: answer,
  };
}

export function sentenceExercise(sentence: Sentence): Exercise {
  return {
    id: `sentence-${sentence.id}`,
    mode: "sentence",
    answer: sentence.text,
    sentence,
    start: Math.max(0, sentence.start - 0.12),
    end: sentence.end + 0.28,
    contextLine: "Listen for the whole line, then reconstruct it.",
    translation: sentence.translation,
    hint: `${sentence.words.length} words · starts with “${sentence.words[0]?.text ?? ""}”`,
    savedText: sentence.text,
  };
}

function targetWordsForSentence(sentence: Sentence): WordToken[] {
  const candidates = sentence.words
    .filter((token) => isContentWord(token.text))
    .sort((a, b) => b.text.length - a.text.length);
  return candidates.slice(0, 2);
}

export function buildSession(
  lesson: Lesson,
  mode: ExerciseMode,
  count: number,
  savedItems: LearningItem[] = [],
  seed = 1,
  startIndex = 0,
): Exercise[] {
  if (mode === "sentence") {
    // Dictation follows the lesson in order. A sentence round is a line-by-line
    // pass, not a random quiz. startIndex lets a learner begin at the line they
    // are watching or jump into the middle of a long lesson.
    const start = Math.max(0, Math.min(startIndex, Math.max(0, lesson.sentences.length - 1)));
    return lesson.sentences.slice(start, start + count).map(sentenceExercise);
  }

  if (mode === "phrase") {
    const phrases: Exercise[] = [];
    const seen = new Set<string>();
    for (const phrase of lesson.focusPhrases ?? []) {
      const sentence = lesson.sentences[phrase.sentence];
      if (!sentence) continue;
      const tokens = findPhraseTokens(sentence, phrase.text);
      if (tokens.length < 2) continue;
      const key = normalizeWord(tokens.map((token) => token.text).join(" "));
      if (seen.has(key)) continue;
      seen.add(key);
      phrases.push(phraseExercise(sentence, tokens, phrase.translation));
    }
    for (const item of savedItems) {
      if (item.type !== "phrase" || item.context.lessonId !== lesson.id) continue;
      const sentence = lesson.sentences.find((entry) => entry.id === item.context.sentenceId);
      if (!sentence) continue;
      const tokens = findPhraseTokens(sentence, item.text);
      if (tokens.length < 2) continue;
      const key = normalizeWord(tokens.map((token) => token.text).join(" "));
      if (seen.has(key)) continue;
      seen.add(key);
      phrases.push(phraseExercise(sentence, tokens, item.translation));
    }
    return shuffled(phrases, seed + 11).slice(0, count);
  }

  const exercises: Exercise[] = [];
  const seen = new Set<string>();
  for (const sentence of lesson.sentences) {
    for (const token of targetWordsForSentence(sentence)) {
      const key = normalizeWord(token.text);
      if (seen.has(key)) continue;
      seen.add(key);
      exercises.push(wordExercise(sentence, token));
    }
  }
  return shuffled(exercises, seed + 7).slice(0, count);
}

export function availableModes(lesson: Lesson, savedItems: LearningItem[]): Record<ExerciseMode, number> {
  const words = lesson.sentences.reduce((total, sentence) => {
    const seen = new Set<string>();
    for (const token of sentence.words) {
      if (isContentWord(token.text) && !seen.has(normalizeWord(token.text))) seen.add(normalizeWord(token.text));
    }
    return total + seen.size;
  }, 0);
  let phrases = lesson.focusPhrases?.length ?? 0;
  phrases += savedItems.filter((item) => item.type === "phrase" && item.context.lessonId === lesson.id).length;
  return {
    word: Math.min(8, words),
    phrase: Math.min(8, phrases),
    sentence: lesson.sentences.length,
  };
}

export function exerciseForSavedItem(item: LearningItem, lesson: Lesson): Exercise | null {
  const sentence = lesson.sentences.find((entry) => entry.id === item.context.sentenceId);
  if (!sentence) return null;
  if (item.type === "sentence") return sentenceExercise(sentence);
  if (item.type === "word") {
    const token = sentence.words.find(
      (entry) => normalizeWord(entry.text) === normalizeWord(item.text),
    );
    return token ? wordExercise(sentence, token) : null;
  }
  const tokens = findPhraseTokens(sentence, item.text);
  return tokens.length >= 2 ? phraseExercise(sentence, tokens, item.translation) : null;
}

export function exerciseRangeLabel(exercise: Exercise): string {
  const duration = clamp(exercise.end - exercise.start, 0.2, 30);
  return `${duration.toFixed(1)}s clip`;
}
