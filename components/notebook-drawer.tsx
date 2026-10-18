"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlignLeft,
  BookOpenText,
  Download,
  Headphones,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { LearningItem, Lesson, Sentence } from "@/lib/types";
import { formatSavedDate, typeLabel, type ManualItemDraft } from "@/lib/learning";
import { formatTime } from "@/lib/text";

type NotebookDrawerProps = {
  open: boolean;
  lesson: Lesson;
  items: LearningItem[];
  onClose: () => void;
  onJump: (item: LearningItem) => void;
  onDelete: (item: LearningItem) => void;
  onPractice: (item: LearningItem) => void;
  onExport: () => void;
  onExportCsv: () => void;
  onStartPractice: () => void;
  onAddManual: (draft: ManualItemDraft) => boolean;
  currentSentence?: Sentence;
};

type Filter = "all" | LearningItem["type"] | "review" | "mastered";

export function NotebookDrawer({
  open,
  lesson,
  items,
  onClose,
  onJump,
  onDelete,
  onPractice,
  onExport,
  onExportCsv,
  onStartPractice,
  onAddManual,
  currentSentence,
}: NotebookDrawerProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draftType, setDraftType] = useState<LearningItem["type"]>("word");
  const [draftText, setDraftText] = useState("");
  const [draftTranslation, setDraftTranslation] = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setAdding(false);
    setDraftText("");
    setDraftTranslation("");
    setAddError("");
  }, [open]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "review") {
        const needsReview = item.practice.attempts === 0 || item.practice.correct / item.practice.attempts < 0.7;
        if (!needsReview) return false;
      } else if (filter === "mastered") {
        const isMastered = item.practice.attempts > 0 && item.practice.correct / item.practice.attempts >= 0.7;
        if (!isMastered) return false;
      } else if (filter !== "all" && item.type !== filter) {
        return false;
      }
      if (!search) return true;
      return [item.text, item.translation, item.definition, item.context.sentence]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search));
    });
  }, [filter, items, query]);

  const counts = useMemo(
    () => ({
      all: items.length,
      word: items.filter((item) => item.type === "word").length,
      phrase: items.filter((item) => item.type === "phrase").length,
      sentence: items.filter((item) => item.type === "sentence").length,
      review: items.filter((item) => item.practice.attempts === 0 || item.practice.correct / item.practice.attempts < 0.7).length,
      mastered: items.filter((item) => item.practice.attempts > 0 && item.practice.correct / item.practice.attempts >= 0.7).length,
    }),
    [items],
  );

  if (!open) return null;

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Learning notebook">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close notebook" />
      <aside className="notebook-drawer">
        <header className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-icon">
              <BookOpenText size={19} />
            </span>
            <div>
              <p className="section-kicker">Your notebook</p>
              <h2>Kept in context.</h2>
            </div>
          </div>
          <div className="drawer-header-actions">
            <button
              type="button"
              className={`drawer-add-button ${adding ? "is-active" : ""}`}
              onClick={() => {
                setAdding((value) => !value);
                setAddError("");
              }}
            >
              <Plus size={15} />
              Add
            </button>
            <button type="button" className="icon-close" onClick={onClose} aria-label="Close notebook">
              <X size={19} />
            </button>
          </div>
        </header>

        {adding ? (
          <form
            className="notebook-add-form"
            onSubmit={(event) => {
              event.preventDefault();
              const ok = onAddManual({
                type: draftType,
                text: draftText,
                translation: draftTranslation,
              });
              if (ok) {
                setDraftText("");
                setDraftTranslation("");
                setAdding(false);
                setAddError("");
                setFilter("all");
                setQuery("");
              } else {
                setAddError("That entry is already in your notebook, or the text is empty.");
              }
            }}
          >
            <div className="notebook-add-types">
              {(["word", "phrase", "sentence"] as LearningItem["type"][]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={draftType === type ? "is-active" : ""}
                  onClick={() => setDraftType(type)}
                >
                  {typeLabel(type)}
                </button>
              ))}
            </div>
            <input
              className="notebook-add-input"
              value={draftText}
              onChange={(event) => {
                setDraftText(event.target.value);
                setAddError("");
              }}
              placeholder={draftType === "word" ? "Word to keep" : draftType === "phrase" ? "Phrase to keep" : "Line to keep"}
              aria-label="New notebook text"
              autoFocus
            />
            <input
              className="notebook-add-input notebook-add-translation"
              value={draftTranslation}
              onChange={(event) => setDraftTranslation(event.target.value)}
              placeholder="Optional meaning or note"
              aria-label="New notebook meaning"
            />
            {currentSentence ? (
              <p className="notebook-add-context">Saved against: “{currentSentence.text}”</p>
            ) : null}
            {addError ? <p className="notebook-add-error">{addError}</p> : null}
            <div className="notebook-add-actions">
              <button type="button" className="text-button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="submit" className="button button-dark button-small" disabled={!draftText.trim()}>
                <Plus size={14} />
                Add to notebook
              </button>
            </div>
          </form>
        ) : null}

        <div className="drawer-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words, phrases, lines…"
            aria-label="Search notebook"
          />
        </div>

        <div className="notebook-filters">
          {(
            [
              { id: "all", label: "All" },
              { id: "word", label: "Words" },
              { id: "phrase", label: "Phrases" },
              { id: "sentence", label: "Lines" },
              { id: "review", label: "Review" },
              { id: "mastered", label: "Mastered" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={filter === id ? "is-active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
              <span>{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="notebook-list">
          {filtered.length ? (
            filtered.map((item) => {
              const sameLesson = item.context.lessonId === lesson.id;
              return (
                <article className="notebook-item" key={item.id}>
                  <div className="notebook-item-top">
                    <span className={`notebook-type type-${item.type}`}>
                      {item.type === "word" ? <Sparkles size={13} /> : item.type === "phrase" ? <AlignLeft size={13} /> : <BookOpenText size={13} />}
                      {typeLabel(item.type)}
                    </span>
                    <span className="notebook-date">
                      {!sameLesson ? `[${item.context.lessonTitle}] · ` : ""}
                      {formatSavedDate(item.createdAt)}
                    </span>
                  </div>
                  <h3>{item.text}</h3>
                  {item.phonetic ? <span className="notebook-phonetic">{item.phonetic}</span> : null}
                  {item.translation ? (
                    <p className="notebook-translation">
                      {item.translation}
                      {item.translationSource === "machine" ? (
                        <span className="machine-gloss" title="MyMemory machine translation">机翻</span>
                      ) : null}
                    </p>
                  ) : null}
                  {item.definition ? <p className="notebook-definition">{item.definition}</p> : null}
                  <blockquote>
                    <span>{formatTime(item.context.start)}</span>
                    {item.context.sentence}
                  </blockquote>
                  {item.practice.attempts > 0 ? (
                    <div className="notebook-practice-stat">
                      <Headphones size={12} />
                      {item.practice.correct}/{item.practice.attempts} exact in practice
                    </div>
                  ) : null}
                  <div className="notebook-actions">
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => onJump(item)}
                      disabled={!sameLesson}
                      title={sameLesson ? "Play the original line" : "This item belongs to another lesson"}
                    >
                      <MapPin size={13} />
                      {sameLesson ? "Replay source" : "Other lesson"}
                    </button>
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => onPractice(item)}
                      disabled={!sameLesson}
                    >
                      <Headphones size={13} />
                      Practice
                    </button>
                    <button
                      type="button"
                      className="small-action small-action-danger"
                      onClick={() => onDelete(item)}
                      aria-label={`Remove ${item.text} from notebook`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="notebook-empty">
              <span className="empty-orbit">
                <BookOpenText size={24} />
              </span>
              <h3>{items.length ? "Nothing matches that search." : "Your notebook is still quiet."}</h3>
              <p>
                {items.length
                  ? "Try a different word or clear the filter."
                  : "Click a word in the transcript, or save a line that sounds worth keeping."}
              </p>
              {!items.length ? (
                <button type="button" className="button button-dark button-small" onClick={onClose}>
                  Back to the lesson
                </button>
              ) : null}
            </div>
          )}
        </div>

        <footer className="drawer-footer">
          <button type="button" className="button button-coral button-small" onClick={onStartPractice}>
            <Headphones size={15} />
            Practice this lesson
          </button>
          <div className="drawer-export-row">
            <button type="button" className="text-button" onClick={onExport} disabled={!items.length}>
              <Download size={14} />
              Export JSON
            </button>
            <button type="button" className="text-button" onClick={onExportCsv} disabled={!items.length}>
              <Download size={14} />
              Export CSV
            </button>
          </div>
          <p>Saved in this browser. Nothing is uploaded.</p>
        </footer>
      </aside>
    </div>
  );
}
