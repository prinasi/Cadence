"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  BookOpenText,
  Headphones,
  Languages,
  Loader2,
  MousePointerClick,
  Play,
  Quote,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import type {
  DictionaryEntry,
  FocusSelection,
  LearningItem,
  Lesson,
  Sentence,
  WordToken,
} from "@/lib/types";
import type { TodayStats } from "@/lib/learning";
import { findSaved, typeLabel } from "@/lib/learning";
import { dictionaryForContext, fetchDictionaryEntry, lookupLocalEntry } from "@/lib/dictionary";
import { findPhraseTokens, formatTime, normalizePhrase } from "@/lib/text";
import { playAudioUrl, speak } from "@/lib/speech";

type InspectorProps = {
  focus: FocusSelection | null;
  lesson: Lesson;
  currentSentence?: Sentence;
  savedItems: LearningItem[];
  today: TodayStats;
  onClose: () => void;
  onToggleSave: (focus: FocusSelection, entry: DictionaryEntry | null) => void;
  onPractice: (focus: FocusSelection) => void;
  onPlayRange: (start: number, end: number, kind: "word" | "sentence") => void;
  onSentenceFocus: (sentence: Sentence) => void;
  onPhraseFocus: (sentence: Sentence, tokens: WordToken[]) => void;
  onOpenNotebook: () => void;
  onStartPractice: () => void;
};

function SourceBadge({ source }: { source: DictionaryEntry["source"] }) {
  const label =
    source === "local" ? "Curated entry" : source === "api" ? "Free Dictionary API" : "Context note";
  return <span className={`source-badge source-${source}`}>{label}</span>;
}

function EmptyInspector({
  lesson,
  currentSentence,
  today,
  savedItems,
  onSentenceFocus,
  onPhraseFocus,
  onOpenNotebook,
  onStartPractice,
}: Pick<
  InspectorProps,
  | "lesson"
  | "currentSentence"
  | "today"
  | "savedItems"
  | "onSentenceFocus"
  | "onPhraseFocus"
  | "onOpenNotebook"
  | "onStartPractice"
>) {
  const sentencePhrases = useMemo(() => {
    if (!currentSentence) return [];
    return (lesson.focusPhrases ?? [])
      .filter((phrase) => phrase.sentence === currentSentence.index)
      .map((phrase) => ({ phrase, tokens: findPhraseTokens(currentSentence, phrase.text) }))
      .filter((entry) => entry.tokens.length >= 2);
  }, [currentSentence, lesson.focusPhrases]);

  return (
    <div className="inspector-empty">
      <div className="inspector-heading">
        <p className="section-kicker">Context inspector</p>
        <span className="inspector-status">
          <span className="live-dot" />
          ready
        </span>
      </div>
      <h2 className="inspector-title">
        Tap a word.
        <br />
        <em>Keep the moment.</em>
      </h2>
      <p className="inspector-copy">
        Every lookup stays attached to the line, the voice, and the second it came from.
      </p>

      {currentSentence ? (
        <div className="current-line-card">
          <div className="current-line-meta">
            <span>Line {String(currentSentence.index + 1).padStart(2, "0")}</span>
            <button type="button" onClick={() => onSentenceFocus(currentSentence)}>
              Inspect <ArrowUpRight size={13} />
            </button>
          </div>
          <p className="current-line-text">“{currentSentence.text}”</p>
          {currentSentence.translation ? (
            <p className="current-line-zh">{currentSentence.translation}</p>
          ) : null}
          {sentencePhrases.length ? (
            <div className="phrase-suggestions">
              <span className="mini-label">Phrases here</span>
              <div className="chip-row">
                {sentencePhrases.map(({ phrase, tokens }) => (
                  <button
                    key={phrase.text}
                    type="button"
                    className="phrase-chip"
                    onClick={() => onPhraseFocus(currentSentence, tokens)}
                  >
                    {phrase.text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="loop-steps">
        <div className="loop-step">
          <span className="step-icon">
            <MousePointerClick size={16} />
          </span>
          <div>
            <strong>Notice</strong>
            <p>Click any word or drag a phrase.</p>
          </div>
        </div>
        <div className="loop-step">
          <span className="step-icon">
            <Bookmark size={16} />
          </span>
          <div>
            <strong>Keep</strong>
            <p>Save it with the original audio.</p>
          </div>
        </div>
        <div className="loop-step">
          <span className="step-icon">
            <Headphones size={16} />
          </span>
          <div>
            <strong>Recall</strong>
            <p>Type it back from the clip.</p>
          </div>
        </div>
      </div>

      <div className="inspector-stats">
        <div>
          <span>{savedItems.length}</span>
          <p>saved items</p>
        </div>
        <div>
          <span>{today.attempts ? `${today.accuracy}%` : "—"}</span>
          <p>today’s ear</p>
        </div>
        <div>
          <span>{today.attempts}</span>
          <p>reps today</p>
        </div>
      </div>

      <div className="inspector-cta-row">
        <button type="button" className="button button-coral button-small" onClick={onStartPractice}>
          <Headphones size={15} />
          Start line dictation
        </button>
        <button type="button" className="text-button" onClick={onOpenNotebook}>
          <BookOpenText size={15} />
          Notebook
        </button>
      </div>
    </div>
  );
}

function DictionaryView({
  focus,
  lesson,
  savedItems,
  onClose,
  onToggleSave,
  onPractice,
  onPlayRange,
}: Pick<
  InspectorProps,
  "focus" | "lesson" | "savedItems" | "onClose" | "onToggleSave" | "onPractice" | "onPlayRange"
> & { focus: FocusSelection }) {
  const [entry, setEntry] = useState<DictionaryEntry | null>(() =>
    lookupLocalEntry(focus.text, focus.type),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const local = lookupLocalEntry(focus.text, focus.type);
    setEntry(local);
    setLoading(false);
    if (focus.type !== "word" || local) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    setLoading(true);
    fetchDictionaryEntry(focus.text, controller.signal)
      .then((result) => {
        if (active) setEntry(result ?? dictionaryForContext(focus.text, focus.type));
      })
      .finally(() => {
        if (active) setLoading(false);
        window.clearTimeout(timer);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [focus]);

  const saved = findSaved(savedItems, focus.type, focus.text);
  const phraseTranslation = useMemo(() => {
    if (focus.type !== "phrase") return undefined;
    const match = lesson.focusPhrases?.find(
      (phrase) => normalizePhrase(phrase.text) === normalizePhrase(focus.text),
    );
    return match?.translation;
  }, [focus, lesson.focusPhrases]);

  const translation = entry?.translation ?? phraseTranslation ?? (focus.type === "sentence" ? focus.sentence.translation : undefined);
  const meaning = entry?.definition ?? (focus.type === "phrase" ? "Read this phrase inside the line before saving it." : undefined);

  const pronounce = () => {
    if (entry?.audio) playAudioUrl(entry.audio);
    else speak(focus.text, 0.82);
  };

  const savedPractice = saved?.practice;
  const practiceRate = savedPractice && savedPractice.attempts > 0 ? `${savedPractice.correct}/${savedPractice.attempts} correct` : null;
  const entryForSave: DictionaryEntry | null =
    entry ??
    (focus.type === "phrase" && phraseTranslation
      ? {
          word: focus.text,
          partOfSpeech: "phrase",
          translation: phraseTranslation,
          definition: "Phrase kept from the original line.",
          source: "context",
        }
      : null);

  return (
    <div className="dictionary-view">
      <div className="inspector-heading">
        <p className="section-kicker">{focus.type === "sentence" ? "Line in context" : `${typeLabel(focus.type)} in context`}</p>
        <button type="button" className="icon-close" onClick={onClose} aria-label="Close inspector">
          <X size={17} />
        </button>
      </div>

      <div className={`dictionary-headword ${focus.type === "sentence" ? "is-sentence" : ""}`}>
        {focus.type === "sentence" ? <Quote size={25} className="headword-quote" /> : null}
        <h2>{focus.text}</h2>
      </div>

      <div className="dictionary-meta">
        {focus.type !== "sentence" ? (
          <button type="button" className="pronounce-button" onClick={pronounce} aria-label="Pronounce">
            <Volume2 size={15} />
            {entry?.phonetic ?? "listen"}
          </button>
        ) : null}
        {entry?.partOfSpeech ? <span className="pos-pill">{entry.partOfSpeech}</span> : null}
        {savedPractice && savedPractice.attempts > 0 ? <span className="practice-pill">{practiceRate}</span> : null}
      </div>

      {loading ? (
        <div className="dictionary-loading">
          <Loader2 size={16} className="spin" />
          Looking up the word…
        </div>
      ) : (
        <>
          {translation ? (
            <div className="meaning-block">
              <span className="meaning-label">
                <Languages size={13} />{" "}
                {entry?.translationSource === "machine" ? "中文速释 · 机翻" : "语境释义"}
              </span>
              <p className="meaning-primary">{translation}</p>
            </div>
          ) : null}

          {meaning ? (
            <div className="definition-block">
              <span className="meaning-label">Meaning</span>
              <p>{meaning}</p>
              {entry?.senses && entry.senses.length > 1 ? (
                <div className="dictionary-senses">
                  {entry.senses.slice(1, 4).map((sense, index) => (
                    <div key={`${sense.definition}-${index}`} className="dictionary-sense">
                      {sense.partOfSpeech ? <span>{sense.partOfSpeech}</span> : null}
                      <p>{sense.definition}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div className="context-block">
        <div className="context-block-head">
          <span className="meaning-label">In this line</span>
          <button type="button" className="context-play" onClick={() => onPlayRange(focus.sentence.start, focus.sentence.end, "sentence")}>
            <Play size={12} fill="currentColor" />
            {formatTime(focus.sentence.start)}
          </button>
        </div>
        <p className="context-quote">{focus.sentence.text}</p>
        {focus.sentence.translation ? <p className="context-translation">{focus.sentence.translation}</p> : null}
        {focus.type !== "sentence" ? (
          <button
            type="button"
            className="hear-clip-button"
            onClick={() => onPlayRange(focus.start, focus.end, "word")}
          >
            <Headphones size={14} />
            Hear “{focus.text}” in the video
          </button>
        ) : null}
      </div>

      {entry?.collocations?.length ? (
        <div className="collocations-block">
          <span className="meaning-label">Commonly paired with</span>
          <div className="chip-row">
            {entry.collocations.map((collocation) => (
              <span className="collocation-chip" key={collocation}>
                {collocation}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {entry?.examples?.length ? (
        <div className="examples-block">
          <span className="meaning-label">Examples</span>
          {entry.examples.map((example) => (
            <p key={example}>{example}</p>
          ))}
        </div>
      ) : null}

      {entry?.note ? <p className="dictionary-note">{entry.note}</p> : null}

      <div className="dictionary-source-row">
        {entry ? <SourceBadge source={entry.source} /> : null}
        <span>{lesson.imported ? "Your imported lesson" : "Original Cadence lesson"}</span>
      </div>

      <div className="dictionary-actions">
        <button
          type="button"
          className={`button ${saved ? "button-saved" : "button-dark"}`}
          onClick={() => onToggleSave(focus, entryForSave)}
        >
          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          {saved ? "Saved to notebook" : "Save this"}
        </button>
        <button type="button" className="button button-ghost" onClick={() => onPractice(focus)}>
          <Sparkles size={15} />
          Practice
        </button>
      </div>
    </div>
  );
}

export function Inspector(props: InspectorProps) {
  return (
    <aside className={`inspector-card ${props.focus ? "has-focus" : ""}`} aria-label="Word inspector">
      {props.focus ? <DictionaryView {...props} focus={props.focus} /> : <EmptyInspector {...props} />}
    </aside>
  );
}
