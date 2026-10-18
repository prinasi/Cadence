"use client";

import { ArrowRight, BookOpenText, Clock3, FileAudio, Headphones, RotateCcw, Sparkles } from "lucide-react";
import type { TodayStats } from "@/lib/learning";
import type { LearningItem, Lesson } from "@/lib/types";
import { formatTime } from "@/lib/text";

type SessionCardProps = {
  lesson: Lesson;
  items: LearningItem[];
  today: TodayStats;
  onStartPractice: () => void;
  onOpenNotebook: () => void;
  onResetToDemo: () => void;
};

export function SessionCard({ lesson, items, today, onStartPractice, onOpenNotebook, onResetToDemo }: SessionCardProps) {
  const wordCount = lesson.sentences.reduce((total, sentence) => total + sentence.words.length, 0);
  const circumference = 2 * Math.PI * 24;
  const dash = today.attempts ? (today.accuracy / 100) * circumference : 0;

  return (
    <section className="session-card" aria-label="Session summary">
      <div className="session-head">
        <div>
          <p className="section-kicker">Session pulse</p>
          <h2 className="session-title">Today’s listening.</h2>
        </div>
        <div className="accuracy-ring" aria-label={`${today.attempts ? today.accuracy : 0}% accuracy`}>
          <svg viewBox="0 0 58 58" aria-hidden="true">
            <circle className="ring-track" cx="29" cy="29" r="24" />
            <circle
              className="ring-progress"
              cx="29"
              cy="29"
              r="24"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <span>{today.attempts ? `${today.accuracy}%` : "—"}</span>
        </div>
      </div>

      <div className="session-stats">
        <div>
          <strong>{today.attempts}</strong>
          <span>reps</span>
        </div>
        <div>
          <strong>{today.replays}</strong>
          <span>replays</span>
        </div>
        <div>
          <strong>{items.length}</strong>
          <span>saved</span>
        </div>
      </div>

      <button type="button" className="session-cta" onClick={onStartPractice}>
        <span className="session-cta-icon">
          <Headphones size={19} />
        </span>
        <span>
          <strong>Dictate the lesson, line by line</strong>
          <small>Listen to each line. Type it back.</small>
        </span>
        <ArrowRight size={18} />
      </button>

      <div className="session-secondary">
        <button type="button" className="text-button" onClick={onOpenNotebook}>
          <BookOpenText size={15} />
          Open notebook
          {items.length ? <span className="count-pill">{items.length}</span> : null}
        </button>
      </div>

      <div className="lesson-meta-card">
        <div className="lesson-meta-row">
          <span className="meta-icon">
            <FileAudio size={15} />
          </span>
          <div>
            <strong>{lesson.title}</strong>
            <p>{lesson.speaker ?? "Cadence Studio"}</p>
          </div>
        </div>
        <div className="lesson-meta-grid">
          <span>
            <Clock3 size={13} />
            {formatTime(lesson.duration)}
          </span>
          <span>{wordCount} words</span>
          <span>{lesson.sentences.length} lines</span>
        </div>
        <div className="alignment-note">
          <Sparkles size={13} />
          {lesson.alignment === "exact" ? "Word-level timings aligned" : "Word timings estimated from cues"}
        </div>
      </div>

      {lesson.imported ? (
        <button type="button" className="reset-demo" onClick={onResetToDemo}>
          <RotateCcw size={13} />
          Return to the demo lesson
        </button>
      ) : null}
    </section>
  );
}
