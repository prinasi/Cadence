"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Ear,
  EyeOff,
  Gauge,
  Headphones,
  Lightbulb,
  ListStart,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import type {
  DictionaryEntry,
  Exercise,
  ExerciseMode,
  LearningItem,
  Lesson,
  PracticeAttempt,
  Sentence,
  WordToken,
} from "@/lib/types";
import { availableModes, buildSession, exerciseRangeLabel } from "@/lib/exercises";
import {
  compareWords,
  expandContractions,
  formatTime,
  normalizeAnswer,
  normalizeWord,
  scoreAnswer,
} from "@/lib/text";
import { BrandMark } from "./brand";
import { LineVocabulary } from "./line-vocabulary";

type RoundResult = {
  expected: string;
  answer: string;
  correct: boolean;
  score: number;
  replays: number;
  hints: number;
  revealed?: boolean;
  skipped?: boolean;
};

type SessionState = {
  mode: ExerciseMode;
  exercises: Exercise[];
  index: number;
  answer: string;
  checked: boolean;
  feedback: { correct: boolean; score: number; revealed: boolean } | null;
  replays: number;
  hints: number;
  results: RoundResult[];
  finished: boolean;
  seed: number;
  startIndex: number;
};

type PracticeRoomProps = {
  lesson: Lesson;
  savedItems: LearningItem[];
  initialMode: ExerciseMode;
  initialExercise?: Exercise | null;
  initialStartIndex?: number;
  isClipPlaying?: boolean;
  onClose: () => void;
  onPlayClip: (start: number, end: number, rate: number) => void;
  onStopClip: () => void;
  onAttempt: (attempt: PracticeAttempt) => void;
  onSaveWord: (sentence: Sentence, token: WordToken, entry: DictionaryEntry | null) => void;
  onSaveSentence: (sentence: Sentence) => void;
  onSavePhrase: (sentence: Sentence, tokens: WordToken[]) => void;
  onPronounceStart?: () => void;
};

function getProgressiveHint(exercise: Exercise, hintLevel: number): string {
  if (hintLevel <= 0) return exercise.hint;
  if (exercise.mode === "word") {
    const clean = exercise.answer.replace(/[^a-zA-Z0-9]/g, "");
    if (hintLevel === 1) return exercise.hint;
    const prefixLen = Math.min(clean.length - 1, Math.max(2, Math.floor(clean.length / 2)));
    return `Starts with “${clean.slice(0, prefixLen).toUpperCase()}…” · ${clean.length} letters`;
  }
  if (exercise.mode === "sentence") {
    const words = exercise.sentence.words.map((w) => w.text);
    if (hintLevel === 1) return exercise.hint;
    if (hintLevel === 2) {
      const firstTwo = words.slice(0, 2).join(" ");
      return `Starts with: “${firstTwo}…” (${words.length} words total)`;
    }
    const firstFour = words.slice(0, Math.min(4, words.length)).join(" ");
    return `First ${Math.min(4, words.length)} words: “${firstFour}…”`;
  }
  return exercise.hint;
}

const MODE_LABEL: Record<ExerciseMode, string> = {
  sentence: "Lines",
  word: "Words",
  phrase: "Phrases",
};

const MODE_SINGULAR: Record<ExerciseMode, string> = {
  sentence: "Line",
  word: "Word",
  phrase: "Phrase",
};

const PROMPT = {
  word: { title: "Which word did you hear?", sub: "One word is missing from the line. Listen for its shape and stress." },
  phrase: { title: "Catch the phrase.", sub: "Type the words exactly as they run together in the clip." },
  sentence: {
    title: "Type the line you hear.",
    sub: "Listen for the whole sentence, then rebuild it word by word. Punctuation is not counted.",
  },
};

const SESSION_SIZE: Record<ExerciseMode, number> = { word: 5, phrase: 4, sentence: 12 };

function roundSize(mode: ExerciseMode, available: number): number {
  return Math.max(1, Math.min(SESSION_SIZE[mode], available || 1));
}

function makeSession(
  lesson: Lesson,
  savedItems: LearningItem[],
  mode: ExerciseMode,
  seed: number,
  initialExercise?: Exercise | null,
  startIndex = 0,
): SessionState {
  const available = availableModes(lesson, savedItems)[mode];
  const clampedStart =
    mode === "sentence"
      ? Math.max(0, Math.min(startIndex, Math.max(0, lesson.sentences.length - 1)))
      : 0;
  const remaining = mode === "sentence" ? Math.max(1, lesson.sentences.length - clampedStart) : available;
  const exercises =
    initialExercise && initialExercise.mode === mode
      ? [initialExercise]
      : buildSession(
          lesson,
          mode,
          roundSize(mode, remaining),
          savedItems,
          seed,
          clampedStart,
        );
  return {
    mode,
    exercises,
    index: 0,
    answer: "",
    checked: false,
    feedback: null,
    replays: 0,
    hints: 0,
    results: [],
    finished: false,
    seed,
    startIndex: initialExercise?.mode === "sentence" ? initialExercise.sentence.index : clampedStart,
  };
}

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PracticeRoom({
  lesson,
  savedItems,
  initialMode,
  initialExercise,
  initialStartIndex = 0,
  isClipPlaying,
  onClose,
  onPlayClip,
  onStopClip,
  onAttempt,
  onSaveWord,
  onSaveSentence,
  onSavePhrase,
  onPronounceStart,
}: PracticeRoomProps) {
  const modes = useMemo(() => availableModes(lesson, savedItems), [lesson, savedItems]);
  const [session, setSession] = useState<SessionState>(() =>
    makeSession(lesson, savedItems, initialMode, 7, initialExercise, initialStartIndex),
  );
  const [slow, setSlow] = useState(false);
  const [audioScope, setAudioScope] = useState<"clip" | "sentence">("clip");
  const [playing, setPlaying] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);

  const exercise = session.exercises[session.index];
  const total = session.exercises.length;
  const progress = total ? ((session.index + (session.checked ? 1 : 0)) / total) * 100 : 0;

  const clearTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const stopAudio = () => {
    clearTimer();
    setPlaying(false);
    onStopClip();
  };

  useEffect(() => {
    if (isClipPlaying === false && playing) {
      setPlaying(false);
      clearTimer();
    }
  }, [isClipPlaying, playing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopAudio();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
      clearTimer();
      onStopClip();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onStopClip]);

  useEffect(() => {
    stopAudio();
    setShowMeaning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.index, session.mode]);

  useEffect(() => {
    if (session.checked) {
      inputRef.current?.blur();
      singleInputRef.current?.blur();
    } else {
      if (session.mode === "word") singleInputRef.current?.focus();
      else inputRef.current?.focus();
    }
  }, [session.checked, session.mode, session.index]);

  if (!exercise) {
    return null;
  }

  const playAudio = () => {
    if (playing) {
      stopAudio();
      return;
    }
    const rate = slow ? 0.75 : 1;
    const isFullSentence = session.mode === "word" && audioScope === "sentence";
    const start = isFullSentence ? exercise.sentence.start : exercise.start;
    const end = isFullSentence ? exercise.sentence.end : exercise.end;
    onPlayClip(start, end, rate);
    const estimated = ((end - start) / rate + 2.5) * 1000;
    timerRef.current = window.setTimeout(() => {
      setPlaying(false);
      onStopClip();
    }, estimated);
    setPlaying(true);
    setSession((previous) => ({ ...previous, replays: previous.replays + 1 }));
  };

  const changeMode = (mode: ExerciseMode) => {
    if (mode === session.mode || !modes[mode]) return;
    stopAudio();
    setSession((previous) =>
      makeSession(
        lesson,
        savedItems,
        mode,
        previous.seed + 1,
        null,
        mode === "sentence" && previous.mode === "sentence" ? previous.startIndex : 0,
      ),
    );
  };

  const changeStartLine = (startIndex: number) => {
    stopAudio();
    setSession((previous) =>
      makeSession(lesson, savedItems, "sentence", previous.seed + 1, null, startIndex),
    );
  };

  const check = (gaveUp = false) => {
    if (session.checked) return;
    stopAudio();
    const correct =
      !gaveUp &&
      (session.mode === "word"
        ? normalizeWord(session.answer) === normalizeWord(exercise.answer)
        : normalizeAnswer(expandContractions(session.answer)) ===
          normalizeAnswer(expandContractions(exercise.answer)));
    const score = gaveUp ? 0 : scoreAnswer(exercise.answer, session.answer, session.mode);
    const attempt: PracticeAttempt = {
      id: uid("attempt"),
      mode: session.mode,
      expected: exercise.answer,
      answer: session.answer,
      correct,
      score,
      replays: session.replays,
      hints: session.hints,
      lessonId: lesson.id,
      sentenceId: exercise.sentence.id,
      createdAt: new Date().toISOString(),
    };
    onAttempt(attempt);

    // Immediate mastery loop: re-queue missed exercises to the end of the round
    const shouldRecycle = !correct && !gaveUp;
    setSession((previous) => {
      const remaining = previous.exercises.slice(previous.index + 1);
      const alreadyRecycled = remaining.some((ex) => ex.id === exercise.id);
      const exercises = shouldRecycle && !alreadyRecycled ? [...previous.exercises, exercise] : previous.exercises;
      return {
        ...previous,
        exercises,
        checked: true,
        feedback: { correct, score, revealed: gaveUp },
        results: [
          ...previous.results,
          {
            expected: exercise.answer,
            answer: session.answer,
            correct,
            score,
            replays: session.replays,
            hints: session.hints,
            revealed: gaveUp,
          },
        ],
      };
    });
  };

  const advance = (previous: SessionState): SessionState => {
    if (previous.index + 1 >= previous.exercises.length) {
      return { ...previous, finished: true };
    }
    return {
      ...previous,
      index: previous.index + 1,
      answer: "",
      checked: false,
      feedback: null,
      replays: 0,
      hints: 0,
    };
  };

  const next = () => {
    stopAudio();
    setSession(advance);
  };

  const skipCurrent = () => {
    if (session.checked) return;
    stopAudio();
    setSession((previous) => {
      const result: RoundResult = {
        expected: exercise.answer,
        answer: "",
        correct: false,
        score: 0,
        replays: previous.replays,
        hints: previous.hints,
        skipped: true,
      };
      return advance({ ...previous, results: [...previous.results, result] });
    });
  };

  const retry = () => {
    setSession((previous) => ({
      ...previous,
      checked: false,
      feedback: null,
      answer: "",
      replays: 0,
      hints: 0,
      results: previous.results.slice(0, -1),
    }));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const revealHint = () => {
    setSession((previous) => ({ ...previous, hints: previous.hints + 1 }));
  };

  const restart = () => {
    stopAudio();
    setSession((previous) =>
      makeSession(
        lesson,
        savedItems,
        previous.mode,
        previous.seed + 1,
        null,
        previous.mode === "sentence" ? previous.startIndex : 0,
      ),
    );
  };

  const summary = session.finished;
  const attemptedResults = session.results.filter((result) => !result.skipped);
  const skippedCount = session.results.length - attemptedResults.length;
  const correctCount = attemptedResults.filter((result) => result.correct).length;
  const averageScore = attemptedResults.length
    ? attemptedResults.reduce((sum, result) => sum + result.score, 0) / attemptedResults.length
    : 0;
  const totalReplays = attemptedResults.reduce((sum, result) => sum + result.replays, 0);
  const totalHints = attemptedResults.reduce((sum, result) => sum + result.hints, 0);
  const comparison = session.feedback ? compareWords(exercise.answer, session.answer) : null;
  const lineNumber = exercise.sentence.index + 1;
  const exerciseNumber = session.mode === "sentence" ? lineNumber : session.index + 1;
  const unit = session.mode === "sentence" ? "lines" : "clips";

  return (
    <div className="practice-room" role="dialog" aria-modal="true" aria-label="Dictation room">
      <div className="practice-ambient practice-ambient-a" />
      <div className="practice-ambient practice-ambient-b" />
      <header className="practice-header">
        <div className="practice-brand">
          <BrandMark size={26} />
          <span>Dictation room</span>
          <span className="practice-lesson-name">{lesson.title}</span>
        </div>
        <div className="practice-header-actions">
          <span className="practice-progress-label">
            {summary
              ? "Round complete"
              : session.mode === "sentence"
                ? `Line ${lineNumber} / ${lesson.sentences.length}`
                : `${session.index + 1} / ${total}`}
          </span>
          <button
            type="button"
            className="practice-close"
            onClick={() => {
              stopAudio();
              onClose();
            }}
            aria-label="Close dictation room"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="practice-progress">
        <span style={{ width: `${summary ? 100 : progress}%` }} />
      </div>

      {!summary ? (
        <main className="practice-main">
          <section className="practice-left">
            <div className="mode-tabs" role="tablist" aria-label="Practice mode">
              {(["sentence", "word", "phrase"] as ExerciseMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={session.mode === mode}
                  className={session.mode === mode ? "is-active" : ""}
                  disabled={!modes[mode]}
                  onClick={() => changeMode(mode)}
                >
                  {MODE_LABEL[mode]}
                  <span>{modes[mode]}</span>
                </button>
              ))}
            </div>

            {session.mode === "sentence" ? (
              <label className="practice-start-picker" title="Changing this restarts the line round">
                <ListStart size={15} />
                <span>Start from</span>
                <select
                  value={session.startIndex}
                  onChange={(event) => changeStartLine(Number(event.target.value))}
                  aria-label="Start from line"
                >
                  {lesson.sentences.map((lessonSentence, index) => (
                    <option key={lessonSentence.id} value={index}>
                      Line {String(index + 1).padStart(2, "0")} · {lessonSentence.text.slice(0, 52)}
                      {lessonSentence.text.length > 52 ? "…" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="practice-prompt">
              <p className="practice-eyebrow">
                {session.mode === "sentence" ? "Line" : MODE_SINGULAR[session.mode]}{" "}
                {String(exerciseNumber).padStart(2, "0")}
                <span>·</span>
                {exerciseRangeLabel(exercise)}
              </p>
              <h1>{PROMPT[session.mode].title}</h1>
              <p className="practice-sub">{PROMPT[session.mode].sub}</p>
            </div>

            <div className={`audio-console ${playing ? "is-playing" : ""}`}>
              <button type="button" className="audio-orb" onClick={playAudio} aria-label={playing ? "Stop clip" : "Play clip"}>
                <span className="audio-orb-ring" />
                {playing ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" />}
              </button>
              <div className="waveform" aria-hidden="true">
                {[9, 18, 27, 15, 34, 42, 22, 31, 17, 27, 38, 20, 12, 28, 36, 18, 10, 24, 32, 15, 21, 29, 13, 8].map(
                  (height, index) => (
                    <span
                      key={index}
                      style={{
                        height: `${height}px`,
                        animationDelay: `${index * 45}ms`,
                      }}
                    />
                  ),
                )}
              </div>
              <div className="audio-meta">
                <span>{playing ? "Playing from the lesson" : "Press to listen"}</span>
                <strong>{formatTime(exercise.start)} — {formatTime(exercise.end)}</strong>
              </div>
            </div>

            <div className="audio-options">
              <button type="button" className={`slow-button ${slow ? "is-on" : ""}`} onClick={() => setSlow((value) => !value)}>
                <Gauge size={15} />
                Slow 0.75×
              </button>
              {session.mode === "word" ? (
                <div className="audio-scope-toggle">
                  <button
                    type="button"
                    className={`scope-pill ${audioScope === "clip" ? "is-active" : ""}`}
                    onClick={() => {
                      stopAudio();
                      setAudioScope("clip");
                    }}
                  >
                    Word clip
                  </button>
                  <button
                    type="button"
                    className={`scope-pill ${audioScope === "sentence" ? "is-active" : ""}`}
                    onClick={() => {
                      stopAudio();
                      setAudioScope("sentence");
                    }}
                  >
                    Full line
                  </button>
                </div>
              ) : null}
              <span className="replay-count">
                <Volume2 size={14} />
                {session.replays} {session.replays === 1 ? "listen" : "listens"}
              </span>
            </div>

            <div className="practice-context">
              <div className="practice-context-head">
                <span>
                  <Ear size={14} /> {session.mode === "sentence" ? "Full line" : "Context clue"}
                </span>
                {exercise.translation ? (
                  <button type="button" onClick={() => setShowMeaning((value) => !value)}>
                    {showMeaning ? "Hide meaning" : "Show meaning"}
                  </button>
                ) : null}
              </div>
              <p className="practice-context-line">
                {session.mode === "sentence" ? "Reconstruct the whole line from the audio." : exercise.contextLine}
              </p>
              {showMeaning && exercise.translation ? (
                <p className="practice-context-zh">{exercise.translation}</p>
              ) : null}
              {session.hints > 0 ? (
                <div className="hint-reveal">
                  <Lightbulb size={14} />
                  {getProgressiveHint(exercise, session.hints)}
                </div>
              ) : null}
            </div>
          </section>

          <section className="practice-right">
            <div className="answer-card">
              <div className="answer-card-head">
                <div>
                  <p className="section-kicker">Your answer</p>
                  <h2>{session.mode === "word" ? "Type one word" : session.mode === "phrase" ? "Type the phrase" : "Type the full line"}</h2>
                </div>
                <span className="word-count">
                  {(() => {
                    const count = session.answer.trim()
                      ? normalizeAnswer(session.answer).split(" ").filter(Boolean).length
                      : 0;
                    return `${count} ${count === 1 ? "word" : "words"}`;
                  })()}
                </span>
              </div>

              {session.mode === "word" ? (
                <input
                  ref={singleInputRef}
                  type="text"
                  className={`answer-input is-word-input ${session.checked ? "is-checked" : ""} ${
                    session.feedback && !session.feedback.correct ? "is-wrong" : ""
                  }`}
                  value={session.answer}
                  onChange={(event) => setSession((previous) => ({ ...previous, answer: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (session.checked) next();
                      else check(false);
                    }
                  }}
                  disabled={session.checked}
                  placeholder="Type the word you heard…"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Your spelling answer"
                />
              ) : (
                <textarea
                  ref={inputRef}
                  className={`answer-input ${session.checked ? "is-checked" : ""} ${
                    session.feedback && !session.feedback.correct ? "is-wrong" : ""
                  }`}
                  value={session.answer}
                  onChange={(event) => setSession((previous) => ({ ...previous, answer: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (session.checked) next();
                      else check(false);
                    }
                  }}
                  disabled={session.checked}
                  rows={session.mode === "sentence" ? 5 : 2}
                  placeholder={
                    session.mode === "phrase" ? "Type the words together…" : "Write the sentence you heard…"
                  }
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Your dictation answer"
                />
              )}

              {!session.checked ? (
                <>
                  <div className="answer-actions">
                    <div className="answer-tools">
                      <button type="button" className="hint-button" onClick={revealHint}>
                        <Lightbulb size={15} />
                        Hint
                        {session.hints > 0 ? <span>{session.hints}</span> : null}
                      </button>
                      <button type="button" className="unknown-button" onClick={() => check(true)}>
                        <EyeOff size={14} />
                        I don’t know
                      </button>
                      <button type="button" className="skip-button" onClick={skipCurrent}>
                        <SkipForward size={14} />
                        Skip
                      </button>
                    </div>
                    <button
                      type="button"
                      className="button button-coral check-button"
                      onClick={() => check(false)}
                      disabled={!session.answer.trim()}
                    >
                      Check answer
                      <ChevronRight size={17} />
                    </button>
                  </div>
                  <p className="keyboard-tip">
                    <kbd>Enter</kbd> to check · <kbd>Esc</kbd> to leave
                  </p>
                </>
              ) : (
                <div className={`feedback-panel ${session.feedback?.correct ? "is-correct" : "is-incorrect"}`}>
                  <div className="feedback-heading">
                    <span className="feedback-icon">
                      {session.feedback?.correct ? <Check size={17} /> : <X size={17} />}
                    </span>
                    <div>
                      <strong>
                        {session.feedback?.correct
                          ? "That’s it."
                          : session.feedback?.revealed
                            ? "Answer revealed. Take the words with you."
                            : session.feedback && session.feedback.score >= 0.6
                              ? "Close. Listen once more."
                              : "Not quite. Keep the sound."}
                      </strong>
                      <p>{Math.round((session.feedback?.score ?? 0) * 100)}% word match</p>
                    </div>
                  </div>

                  {!session.feedback?.correct && comparison ? (
                    <div className="answer-comparison">
                      <span className="meaning-label">
                        Your answer <em className="compare-legend-inline">red = different · orange = typo</em>
                      </span>
                      {comparison.actual.length ? (
                        <p className="compared-line">
                          {comparison.actual.map((part, index) => (
                            <span
                              key={`${part.text}-${index}`}
                              className={`feedback-word is-${part.status} ${part.typo ? "is-typo" : ""}`}
                              title={part.typoFor ? `Typo for "${part.typoFor}"` : undefined}
                            >
                              {part.text}
                              {part.typoFor ? <em className="typo-tag"> (≈ {part.typoFor})</em> : null}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="compared-empty">No answer typed.</p>
                      )}
                      {comparison.missing.length ? (
                        <p className="missing-line">
                          <span className="missing-label">Missing</span>
                          {comparison.missing.map((word, index) => (
                            <span className="missing-word" key={`${word}-${index}`}>
                              {word}
                            </span>
                          ))}
                        </p>
                      ) : null}
                      <p className="compare-legend">Punctuation is ignored. Orange underlines mark near-spelling typos.</p>
                    </div>
                  ) : null}

                  <div className="correct-sentence-block">
                    <span className="meaning-label">
                      {session.mode === "sentence" ? "Correct sentence" : "Correct answer"}
                    </span>
                    <p>{exercise.answer}</p>
                  </div>

                  {exercise.translation ? <p className="feedback-translation">{exercise.translation}</p> : null}

                  <div className="feedback-actions">
                    <button type="button" className="text-button" onClick={retry}>
                      <RotateCcw size={14} />
                      {session.feedback?.correct ? "Type again" : "Try again"}
                    </button>
                    <button type="button" className="button button-dark" onClick={next}>
                      {session.index + 1 >= total
                        ? "See summary"
                        : session.mode === "sentence"
                          ? "Next line"
                          : "Next clip"}
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <LineVocabulary
                    key={exercise.id}
                    exercise={exercise}
                    answer={session.answer}
                    correct={Boolean(session.feedback?.correct)}
                    gaveUp={Boolean(session.feedback?.revealed)}
                    savedItems={savedItems}
                    onPlayClip={(start, end) => onPlayClip(start, end, 1)}
                    onSaveWord={onSaveWord}
                    onSaveSentence={onSaveSentence}
                    onSavePhrase={onSavePhrase}
                    onPronounceStart={onPronounceStart}
                  />
                </div>
              )}
            </div>

            <div className="practice-side-note">
              <Sparkles size={15} />
              <p>
                This round is scored on exact spelling. Replays and hints are recorded separately, so accuracy never hides
                the effort behind it.
              </p>
            </div>
          </section>
        </main>
      ) : (
        <main className="practice-summary">
          <div className="summary-kicker">
            <Sparkles size={16} />
            Round complete
          </div>
          <h1>
            Your ear is <em>warming up.</em>
          </h1>
          <p className="summary-sub">
            {attemptedResults.length
              ? `${correctCount} of ${attemptedResults.length} attempted ${unit} reconstructed exactly.`
              : `No ${unit} attempted this round.`}
            {skippedCount ? ` ${skippedCount} skipped.` : ""}
            {attemptedResults.length ? " The misses are the useful part — they tell you what to replay next." : ""}
          </p>

          <div className="summary-grid">
            <div className="summary-score">
              <div
                className="summary-ring"
                style={{ background: `conic-gradient(var(--coral) ${Math.round(averageScore * 100)}%, rgba(255,255,255,.12) 0)` }}
              >
                <div>
                  <strong>{Math.round(averageScore * 100)}%</strong>
                  <span>word match</span>
                </div>
              </div>
              <div className="summary-mini">
                <span><strong>{correctCount}</strong> exact</span>
                <span><strong>{totalReplays}</strong> replays</span>
                <span><strong>{totalHints}</strong> hints</span>
                <span><strong>{skippedCount}</strong> skipped</span>
              </div>
            </div>

            <div className="summary-list">
              {session.results.map((result, index) => (
                <div
                  key={`${result.expected}-${index}`}
                  className={`summary-row ${result.correct ? "is-correct" : ""} ${result.skipped ? "is-skipped" : ""}`}
                >
                  <span className="summary-status">
                    {result.skipped ? <SkipForward size={14} /> : result.correct ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div>
                    <p>{result.expected}</p>
                    <span>{result.skipped ? "skipped" : `${Math.round(result.score * 100)}% match`}</span>
                  </div>
                  <span className="summary-answer">
                    {result.skipped ? "skipped" : result.correct ? "exact" : result.revealed ? "revealed" : result.answer || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="summary-actions">
            <button type="button" className="button button-coral" onClick={restart}>
              <RotateCcw size={16} />
              New round
            </button>
            <button type="button" className="button button-ghost-light" onClick={onClose}>
              <ArrowLeft size={16} />
              Back to the lesson
            </button>
            <span className="summary-notebook">
              <Headphones size={15} />
              Missed lines stay in the lesson below.
            </span>
          </div>
        </main>
      )}
    </div>
  );
}
