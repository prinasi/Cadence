"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Headphones,
  Loader2,
  Volume2,
} from "lucide-react";
import type { DictionaryEntry, Exercise, LearningItem, Sentence, WordToken } from "@/lib/types";
import { dictionaryForContext, fetchDictionaryEntry, fetchRelatedPhrases, lookupLocalWord } from "@/lib/dictionary";
import { findSavedInSentence } from "@/lib/learning";
import { isContentWord, normalizeAnswer, normalizeWord } from "@/lib/text";
import { playAudioUrl, speak } from "@/lib/speech";

type LineVocabularyProps = {
  exercise: Exercise;
  answer: string;
  correct: boolean;
  gaveUp: boolean;
  savedItems: LearningItem[];
  onPlayClip: (start: number, end: number) => void;
  onSaveWord: (sentence: Sentence, token: WordToken, entry: DictionaryEntry | null) => void;
  onSaveSentence: (sentence: Sentence) => void;
  onSavePhrase: (sentence: Sentence, tokens: WordToken[]) => void;
  onPronounceStart?: () => void;
};

function candidateWords(exercise: Exercise): WordToken[] {
  const { sentence, mode, wordStart, wordEnd, answer } = exercise;
  if (mode === "word" || mode === "phrase") {
    if (wordStart !== undefined && wordEnd !== undefined) {
      return sentence.words.slice(wordStart, wordEnd + 1);
    }
    const target = sentence.words.find((word) => normalizeWord(word.text) === normalizeWord(answer));
    return target ? [target] : [];
  }
  const seen = new Set<string>();
  return sentence.words.filter((word) => {
    const key = normalizeWord(word.text);
    if (!key || seen.has(key) || !isContentWord(word.text)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function SourceLabel({ source }: { source: DictionaryEntry["source"] }) {
  const label = source === "local" ? "Curated" : source === "api" ? "Free Dictionary" : "Context only";
  return <span className={`source-badge source-${source}`}>{label}</span>;
}

export function LineVocabulary({
  exercise,
  answer,
  correct,
  gaveUp,
  savedItems,
  onPlayClip,
  onSaveWord,
  onSaveSentence,
  onSavePhrase,
  onPronounceStart,
}: LineVocabularyProps) {
  const words = useMemo(() => candidateWords(exercise), [exercise]);
  const userWords = useMemo(() => new Set(normalizeAnswer(answer).split(" ").filter(Boolean)), [answer]);
  const missed = useMemo(
    () => words.filter((word) => !userWords.has(normalizeWord(word.text))),
    [userWords, words],
  );
  const [selectedId, setSelectedId] = useState<string>(() => {
    const keyWord = [...(missed.length ? missed : words)].sort((a, b) => {
      const aCurated = lookupLocalWord(a.text) ? 1 : 0;
      const bCurated = lookupLocalWord(b.text) ? 1 : 0;
      return bCurated - aCurated || b.text.length - a.text.length;
    })[0];
    return keyWord?.id ?? "";
  });
  const selected = words.find((word) => word.id === selectedId) ?? words[0];
  const [entry, setEntry] = useState<DictionaryEntry | null>(() =>
    selected ? lookupLocalWord(selected.text) : null,
  );
  const [phrases, setPhrases] = useState<string[]>(() => lookupLocalWord(selected?.text ?? "")?.collocations ?? []);
  const [loading, setLoading] = useState(false);
  const [loadingPhrases, setLoadingPhrases] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const local = lookupLocalWord(selected.text);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    setEntry(local);
    setPhrases(local?.collocations ?? []);
    setLoading(!local);
    setLoadingPhrases(!local?.collocations?.length);

    const dictionaryPromise = local
      ? Promise.resolve(local)
      : fetchDictionaryEntry(selected.text, controller.signal).then(
          (result) => result ?? dictionaryForContext(selected.text, "word"),
        );
    dictionaryPromise
      .then((dictionary) => {
        if (!active) return;
        setEntry(dictionary);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    if (local?.collocations?.length) {
      setLoadingPhrases(false);
    } else {
      fetchRelatedPhrases(selected.text, controller.signal)
        .then((related) => {
          if (!active) return;
          setPhrases((previous) => Array.from(new Set([...previous, ...related])).slice(0, 6));
        })
        .finally(() => {
          if (active) setLoadingPhrases(false);
        });
    }

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selected]);

  if (!selected) return null;

  const saved = findSavedInSentence(savedItems, "word", selected.text, exercise.sentence.id);
  const savedLine = findSavedInSentence(savedItems, "sentence", exercise.sentence.text, exercise.sentence.id);
  const phraseTokens =
    exercise.mode === "phrase" && exercise.wordStart !== undefined && exercise.wordEnd !== undefined
      ? exercise.sentence.words.slice(exercise.wordStart, exercise.wordEnd + 1)
      : [];
  const phraseText = phraseTokens.map((token) => token.text).join(" ");
  const savedPhrase = phraseText ? findSavedInSentence(savedItems, "phrase", phraseText, exercise.sentence.id) : undefined;
  const selectedIsMissed = missed.some((word) => word.id === selected.id);
  const entryForSave = entry ? { ...entry, collocations: phrases } : null;
  const pronounce = () => {
    onPronounceStart?.();
    if (entry?.audio) playAudioUrl(entry.audio);
    else speak(selected.text, 0.82);
  };

  return (
    <section className="line-vocab" aria-label="Words in this line">
      <div className="line-vocab-head">
        <div>
          <p className="section-kicker">Line vocabulary</p>
          <h3>
            {gaveUp
              ? "The answer is open. Take the words with you."
              : correct
                ? "Line cleared. Keep what matters."
                : "Words worth another listen."}
          </h3>
        </div>
        {exercise.mode === "phrase" ? (
          <button
            type="button"
            className={`save-line-button ${savedPhrase ? "is-saved" : ""}`}
            onClick={() => onSavePhrase(exercise.sentence, phraseTokens)}
          >
            {savedPhrase ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {savedPhrase ? "Phrase saved" : "Save phrase"}
          </button>
        ) : exercise.mode === "sentence" ? (
          <button
            type="button"
            className={`save-line-button ${savedLine ? "is-saved" : ""}`}
            onClick={() => onSaveSentence(exercise.sentence)}
          >
            {savedLine ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {savedLine ? "Line saved" : "Save line"}
          </button>
        ) : null}
      </div>

      <div className="vocab-chips" role="tablist" aria-label="Words in this line">
        {words.map((word) => {
          const isMissed = missed.some((item) => item.id === word.id);
          return (
            <button
              key={word.id}
              type="button"
              role="tab"
              aria-selected={word.id === selected.id}
              className={`vocab-chip ${word.id === selected.id ? "is-active" : ""} ${isMissed ? "is-missed" : ""}`}
              onClick={() => setSelectedId(word.id)}
            >
              {isMissed ? <span className="vocab-miss-dot" /> : null}
              {word.text}
            </button>
          );
        })}
      </div>

      <div className="vocab-detail">
        <div className="vocab-word-head">
          <div>
            <h4>{selected.text}</h4>
            {entry?.phonetic ? <span className="vocab-phonetic">{entry.phonetic}</span> : null}
            {entry?.partOfSpeech ? <span className="vocab-pos">{entry.partOfSpeech}</span> : null}
          </div>
          <div className="vocab-word-tools">
            <button type="button" onClick={pronounce} aria-label={`Pronounce ${selected.text}`}>
              <Volume2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => onPlayClip(selected.start, selected.end)}
              aria-label={`Hear ${selected.text} in the line`}
            >
              <Headphones size={15} />
            </button>
          </div>
        </div>

        {entry?.translation ? (
          <p className="vocab-translation">
            {entry.translation}
            {entry.translationSource === "machine" ? (
              <span className="machine-gloss" title="MyMemory machine translation">机翻</span>
            ) : null}
          </p>
        ) : null}

        {loading ? (
          <div className="vocab-loading">
            <Loader2 size={14} className="spin" />
            Looking up meaning, examples, and phrases…
          </div>
        ) : (
          <>
            {entry?.senses && entry.senses.length > 1 ? (
              <div className="vocab-senses">
                <span className="meaning-label">Meanings</span>
                {entry.senses.slice(0, 4).map((sense, index) => (
                  <div className="vocab-sense" key={`${sense.definition}-${index}`}>
                    {sense.partOfSpeech ? <span className="vocab-sense-pos">{sense.partOfSpeech}</span> : null}
                    <p>{sense.definition}</p>
                  </div>
                ))}
              </div>
            ) : entry?.definition ? (
              <div className="vocab-definition">
                <span className="meaning-label">Meaning</span>
                <p>{entry.definition}</p>
              </div>
            ) : (
              <p className="vocab-empty-note">
                No public definition found. The line context is still saved with the word.
              </p>
            )}

            {entry?.examples?.length ? (
              <div className="vocab-examples">
                <span className="meaning-label">Examples</span>
                {entry.examples.map((example) => (
                  <p key={example}>{example}</p>
                ))}
              </div>
            ) : null}

            {phrases.length || loadingPhrases ? (
              <div className="vocab-phrases">
                <span className="meaning-label">
                  Common phrases
                  <span className="phrase-source">{entry?.source === "local" ? "curated" : "Datamuse"}</span>
                </span>
                {loadingPhrases ? (
                  <span className="vocab-inline-loading">Finding phrases…</span>
                ) : (
                  <div className="chip-row">
                    {phrases.map((phrase) => (
                      <span className="collocation-chip" key={phrase}>
                        {phrase}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}

        <div className="vocab-detail-footer">
          <SourceLabel source={entry?.source ?? "context"} />
          {selectedIsMissed ? (
            <span className="vocab-missed-note">
              <Check size={12} /> missed in this attempt
            </span>
          ) : null}
          <button
            type="button"
            className={`button button-small ${saved ? "button-saved" : "button-dark"}`}
            onClick={() => onSaveWord(exercise.sentence, selected, entryForSave)}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {saved ? "In notebook" : "Save word"}
          </button>
        </div>
      </div>
    </section>
  );
}
