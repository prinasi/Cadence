import type {
  DictionaryEntry,
  FocusSelection,
  LearningItem,
  Lesson,
  PracticeAttempt,
  Sentence,
} from "./types";
import { hashString, normalizeAnswer, normalizeWord } from "./text";

export function itemIdentity(type: LearningItem["type"], text: string): string {
  const normalized = type === "word" ? normalizeWord(text) : normalizeAnswer(text);
  return `${type}:${normalized}`;
}

export function makeLearningItem(
  focus: FocusSelection,
  entry: DictionaryEntry | null,
  lesson: Lesson,
): LearningItem {
  const normalized = focus.type === "word" ? normalizeWord(focus.text) : normalizeAnswer(focus.text);
  const sentence = focus.sentence;
  return {
    id: `${focus.type}-${sentence.id}-${hashString(normalized)}`,
    type: focus.type,
    text: focus.text.trim(),
    normalized,
    translation: entry?.translation ?? (focus.type === "sentence" ? sentence.translation : undefined),
    translationSource: entry?.translationSource,
    phonetic: entry?.phonetic,
    partOfSpeech: entry?.partOfSpeech,
    definition: entry?.definition,
    senses: entry?.senses,
    examples: entry?.examples,
    collocations: entry?.collocations,
    note: entry?.note,
    context: {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      sentenceId: sentence.id,
      sentence: sentence.text,
      translation: sentence.translation,
      start: focus.start,
      end: focus.end,
    },
    createdAt: new Date().toISOString(),
    practice: { attempts: 0, correct: 0 },
  };
}

export type ManualItemDraft = {
  type: LearningItem["type"];
  text: string;
  translation?: string;
};

export function makeManualLearningItem(
  draft: ManualItemDraft,
  lesson: Lesson,
  sentence: Sentence,
  entry: DictionaryEntry | null = null,
): LearningItem {
  const text = draft.text.trim();
  const normalized = draft.type === "word" ? normalizeWord(text) : normalizeAnswer(text);
  return {
    id: `${draft.type}-${sentence.id}-${hashString(normalized)}`,
    type: draft.type,
    text,
    normalized,
    translation: draft.translation?.trim() || entry?.translation,
    translationSource: draft.translation?.trim() ? "curated" : entry?.translationSource,
    phonetic: entry?.phonetic,
    partOfSpeech: entry?.partOfSpeech,
    definition: entry?.definition,
    senses: entry?.senses,
    examples: entry?.examples,
    collocations: entry?.collocations,
    note: entry?.note ?? "Added manually to the notebook.",
    context: {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      sentenceId: sentence.id,
      sentence: sentence.text,
      translation: sentence.translation,
      start: sentence.start,
      end: sentence.end,
    },
    createdAt: new Date().toISOString(),
    practice: { attempts: 0, correct: 0 },
  };
}

export function isSaved(items: LearningItem[], type: LearningItem["type"], text: string): boolean {
  const key = itemIdentity(type, text);
  return items.some((item) => itemIdentity(item.type, item.text) === key);
}

export function isSavedInSentence(
  items: LearningItem[],
  type: LearningItem["type"],
  text: string,
  sentenceId: string,
): boolean {
  const key = itemIdentity(type, text);
  return items.some(
    (item) => itemIdentity(item.type, item.text) === key && item.context.sentenceId === sentenceId,
  );
}

export function findSaved(items: LearningItem[], type: LearningItem["type"], text: string): LearningItem | undefined {
  const key = itemIdentity(type, text);
  return items.find((item) => itemIdentity(item.type, item.text) === key);
}

export function findSavedInSentence(
  items: LearningItem[],
  type: LearningItem["type"],
  text: string,
  sentenceId: string,
): LearningItem | undefined {
  const key = itemIdentity(type, text);
  return items.find(
    (item) => itemIdentity(item.type, item.text) === key && item.context.sentenceId === sentenceId,
  );
}

export function formatSavedDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

export function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type TodayStats = {
  attempts: number;
  correct: number;
  accuracy: number;
  replays: number;
};

export function getTodayStats(attempts: PracticeAttempt[]): TodayStats {
  const today = localDayKey();
  const current = attempts.filter((attempt) => {
    try {
      return localDayKey(new Date(attempt.createdAt)) === today;
    } catch {
      return false;
    }
  });
  const correct = current.filter((attempt) => attempt.correct).length;
  return {
    attempts: current.length,
    correct,
    accuracy: current.length ? Math.round((correct / current.length) * 100) : 0,
    replays: current.reduce((sum, attempt) => sum + attempt.replays, 0),
  };
}

export function updateItemPractice(items: LearningItem[], attempt: PracticeAttempt): LearningItem[] {
  return items.map((item) => {
    if (item.type !== attempt.mode) return item;
    const expected = attempt.mode === "word" ? normalizeWord(attempt.expected) : normalizeAnswer(attempt.expected);
    if (item.normalized !== expected) return item;
    return {
      ...item,
      practice: {
        attempts: item.practice.attempts + 1,
        correct: item.practice.correct + (attempt.correct ? 1 : 0),
        lastPracticedAt: attempt.createdAt,
      },
    };
  });
}

export function typeLabel(type: LearningItem["type"]): string {
  if (type === "word") return "Word";
  if (type === "phrase") return "Phrase";
  return "Sentence";
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json");
}

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function itemsToCsv(items: LearningItem[]): string {
  const header = [
    "type",
    "text",
    "translation",
    "translation_source",
    "phonetic",
    "part_of_speech",
    "definition",
    "senses",
    "examples",
    "collocations",
    "context_sentence",
    "context_translation",
    "lesson",
    "start_seconds",
    "end_seconds",
    "created_at",
    "practice_attempts",
    "practice_correct",
  ];
  const rows = items.map((item) =>
    [
      item.type,
      item.text,
      item.translation,
      item.translationSource,
      item.phonetic,
      item.partOfSpeech,
      item.definition,
      item.senses?.map((sense) => `${sense.partOfSpeech ?? ""}: ${sense.definition}`).join(" | "),
      item.examples?.join(" | "),
      item.collocations?.join(" | "),
      item.context.sentence,
      item.context.translation,
      item.context.lessonTitle,
      item.context.start.toFixed(3),
      item.context.end.toFixed(3),
      item.createdAt,
      item.practice.attempts,
      item.practice.correct,
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${[header.map(csvCell).join(","), ...rows].join("\n")}`;
}
