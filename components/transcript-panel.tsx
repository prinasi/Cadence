"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, ChevronsDown, Languages, LocateFixed, MousePointer2, Subtitles } from "lucide-react";
import type { Sentence, WordToken } from "@/lib/types";
import { activeWordIndex, formatTime } from "@/lib/text";

type TranscriptPanelProps = {
  sentences: Sentence[];
  currentSentenceId?: string;
  currentTime: number;
  activeWordId?: string;
  showEnglish: boolean;
  showChinese: boolean;
  onToggleEnglish: () => void;
  onToggleChinese: () => void;
  onSeek: (time: number) => void;
  onWordClick: (sentence: Sentence, token: WordToken) => void;
  onPhraseSelect: (sentence: Sentence, tokens: WordToken[]) => void;
  onSaveSentence: (sentence: Sentence) => void;
};

export function TranscriptPanel({
  sentences,
  currentSentenceId,
  currentTime,
  activeWordId,
  showEnglish,
  showChinese,
  onToggleEnglish,
  onToggleChinese,
  onSeek,
  onWordClick,
  onPhraseSelect,
  onSaveSentence,
}: TranscriptPanelProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (!follow || !showEnglish) return;
    const scroller = scrollerRef.current;
    const card = currentSentenceId ? cardRefs.current.get(currentSentenceId) : null;
    if (!scroller || !card) return;
    const top = card.offsetTop - scroller.offsetTop;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    if (top < viewTop + 16 || top + card.offsetHeight > viewBottom - 16) {
      scroller.scrollTo({ top: Math.max(0, top - 20), behavior: "smooth" });
    }
  }, [currentSentenceId, follow, showEnglish]);

  const handleSelection = (sentence: Sentence, event: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;
    const root = event.currentTarget;
    if (!selection.anchorNode || !root.contains(selection.anchorNode)) return;
    if (!selection.focusNode || !root.contains(selection.focusNode)) return;
    const selectedTokens = sentence.words.filter((token) => {
      const node = root.querySelector<HTMLElement>(`[data-token-id="${token.id}"]`);
      return node ? selection.containsNode(node, true) : false;
    });
    if (selectedTokens.length < 2) return;
    selection.removeAllRanges();
    onPhraseSelect(sentence, selectedTokens);
  };

  return (
    <section className="transcript-card" aria-label="Lesson transcript">
      <header className="transcript-head">
        <div>
          <p className="section-kicker">Transcript</p>
          <h2 className="section-title">Follow every word.</h2>
        </div>
        <div className="transcript-tools">
          <button
            type="button"
            className={`tool-chip ${showEnglish ? "is-on" : ""}`}
            onClick={onToggleEnglish}
            aria-pressed={showEnglish}
          >
            <Subtitles size={15} />
            English
          </button>
          <button
            type="button"
            className={`tool-chip ${showChinese ? "is-on" : ""}`}
            onClick={onToggleChinese}
            aria-pressed={showChinese}
          >
            <Languages size={15} />
            中文
          </button>
          <button
            type="button"
            className={`tool-chip tool-chip-icon ${follow ? "is-on" : ""}`}
            onClick={() => setFollow((value) => !value)}
            aria-pressed={follow}
            aria-label={follow ? "Stop following current line" : "Follow current line"}
            title="Follow current line"
          >
            <LocateFixed size={15} />
          </button>
        </div>
      </header>

      <div className="transcript-hint">
        <MousePointer2 size={13} />
        Click a word for meaning · drag across words to capture a phrase
      </div>

      {!showEnglish ? (
        <div className="transcript-locked">
          <span className="locked-icon">
            <Subtitles size={22} />
          </span>
          <h3>Listening mode is on.</h3>
          <p>Hide the words and let your ears do the work. You can reveal them whenever you need.</p>
          <button type="button" className="button button-dark button-small" onClick={onToggleEnglish}>
            Show subtitles
          </button>
        </div>
      ) : (
        <div className="transcript-scroll" ref={scrollerRef}>
          {sentences.map((sentence) => {
            const isCurrent = sentence.id === currentSentenceId;
            const activeIndex = isCurrent ? activeWordIndex(sentence, currentTime) : -1;
            return (
              <div
                key={sentence.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(sentence.id, node);
                  else cardRefs.current.delete(sentence.id);
                }}
                className={`transcript-line ${isCurrent ? "is-current" : ""}`}
                onMouseUp={(event) => handleSelection(sentence, event)}
              >
                <button
                  type="button"
                  className="line-time"
                  onClick={() => onSeek(sentence.start)}
                  aria-label={`Jump to ${formatTime(sentence.start)}`}
                >
                  {formatTime(sentence.start)}
                </button>
                <div className="line-body">
                  <p className="line-english">
                    {sentence.words.map((token, index) => (
                      <span
                        key={token.id}
                        data-token-id={token.id}
                        className={`word-token ${index === activeIndex ? "is-active" : ""} ${
                          activeWordId === token.id ? "is-selected" : ""
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const selection = window.getSelection();
                          if (selection && !selection.isCollapsed) return;
                          onWordClick(sentence, token);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onWordClick(sentence, token);
                          }
                        }}
                      >
                        {token.display}{" "}
                      </span>
                    ))}
                  </p>
                  {showChinese && sentence.translation ? (
                    <p className="line-chinese">{sentence.translation}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="line-save"
                  onClick={() => onSaveSentence(sentence)}
                  aria-label="Save this sentence"
                  title="Save this sentence"
                >
                  <BookmarkPlus size={16} />
                </button>
              </div>
            );
          })}
          <div className="transcript-end">
            <ChevronsDown size={15} />
            End of transcript
          </div>
        </div>
      )}
    </section>
  );
}
