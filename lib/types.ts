export type WordToken = {
  id: string;
  text: string;
  display: string;
  prefix?: string;
  suffix?: string;
  start: number;
  end: number;
};

export type Sentence = {
  id: string;
  index: number;
  text: string;
  translation?: string;
  start: number;
  end: number;
  words: WordToken[];
};

export type FocusPhrase = {
  text: string;
  translation: string;
  sentence: number;
};

export type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  speaker?: string;
  accent?: string;
  level?: string;
  duration: number;
  videoSrc: string;
  poster?: string;
  sourceNote?: string;
  alignment: "exact" | "estimated";
  tags?: string[];
  sentences: Sentence[];
  focusPhrases?: FocusPhrase[];
  imported?: boolean;
  subtitleName?: string;
};

export type LearningItemType = "word" | "phrase" | "sentence";

export type LearningItem = {
  id: string;
  type: LearningItemType;
  text: string;
  normalized: string;
  translation?: string;
  translationSource?: "curated" | "machine";
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  senses?: DictionarySense[];
  examples?: string[];
  collocations?: string[];
  note?: string;
  context: {
    lessonId: string;
    lessonTitle: string;
    sentenceId: string;
    sentence: string;
    translation?: string;
    start: number;
    end: number;
  };
  createdAt: string;
  practice: {
    attempts: number;
    correct: number;
    lastPracticedAt?: string;
  };
};

export type FocusSelection =
  | {
      type: "word";
      text: string;
      normalized: string;
      sentence: Sentence;
      token: WordToken;
      start: number;
      end: number;
    }
  | {
      type: "phrase";
      text: string;
      normalized: string;
      sentence: Sentence;
      tokens: WordToken[];
      start: number;
      end: number;
    }
  | {
      type: "sentence";
      text: string;
      normalized: string;
      sentence: Sentence;
      start: number;
      end: number;
    };

export type DictionarySense = {
  partOfSpeech?: string;
  definition: string;
  example?: string;
};

export type DictionaryEntry = {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  translation?: string;
  translationSource?: "curated" | "machine";
  definition?: string;
  senses?: DictionarySense[];
  examples?: string[];
  collocations?: string[];
  note?: string;
  audio?: string;
  source: "local" | "api" | "context";
};

export type ExerciseMode = "word" | "phrase" | "sentence";

export type Exercise = {
  id: string;
  mode: ExerciseMode;
  answer: string;
  sentence: Sentence;
  start: number;
  end: number;
  wordStart?: number;
  wordEnd?: number;
  maskStart?: number;
  maskEnd?: number;
  contextLine: string;
  translation?: string;
  hint: string;
  savedText?: string;
};

export type PracticeAttempt = {
  id: string;
  mode: ExerciseMode;
  expected: string;
  answer: string;
  correct: boolean;
  score: number;
  replays: number;
  hints: number;
  lessonId: string;
  sentenceId: string;
  createdAt: string;
};

export type PlayerSettings = {
  showEnglish: boolean;
  showChinese: boolean;
  rate: number;
};

export type PlayRange = {
  start: number;
  end: number;
  loop: boolean;
  kind: "sentence" | "practice" | "word";
};
