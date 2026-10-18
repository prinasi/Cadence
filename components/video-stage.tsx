"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Captions,
  CaptionsOff,
  Expand,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Lesson, PlayerSettings, Sentence, WordToken } from "@/lib/types";
import { activeWordIndex, formatTime, sentenceAtTime } from "@/lib/text";
import { withBasePath } from "@/lib/paths";

type VideoStageProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  lesson: Lesson;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  settings: PlayerSettings;
  loopActive: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onRateChange: (rate: number) => void;
  onToggleEnglish: () => void;
  onToggleLoop: () => void;
  onWordClick: (sentence: Sentence, token: WordToken) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onError: () => void;
};

function CaptionLine({
  sentence,
  time,
  showEnglish,
  showChinese,
  onWordClick,
}: {
  sentence: Sentence;
  time: number;
  showEnglish: boolean;
  showChinese: boolean;
  onWordClick: (sentence: Sentence, token: WordToken) => void;
}) {
  const isSpeaking = time >= sentence.start - 0.15 && time <= sentence.end + 0.3;
  const active = isSpeaking ? activeWordIndex(sentence, time) : -1;
  if (!showEnglish) {
    return (
      <div className="video-caption video-caption-listening">
        <span className="listening-dot" />
        Listening mode
        <span className="listening-hint">press C to show subtitles</span>
      </div>
    );
  }
  return (
    <div className={`video-caption ${!isSpeaking ? "video-caption-dimmed" : ""}`}>
      <p>
        {sentence.words.map((token, index) => (
          <span
            key={token.id}
            className={`caption-word ${index === active ? "is-active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onWordClick(sentence, token);
            }}
            role="button"
            tabIndex={-1}
          >
            {token.display}{" "}
          </span>
        ))}
      </p>
      {showChinese && sentence.translation ? (
        <p className="video-caption-zh">{sentence.translation}</p>
      ) : null}
    </div>
  );
}

export function VideoStage({
  videoRef,
  lesson,
  currentTime,
  duration,
  isPlaying,
  settings,
  loopActive,
  onTogglePlay,
  onSeek,
  onRateChange,
  onToggleEnglish,
  onToggleLoop,
  onWordClick,
  onPlay,
  onPause,
  onEnded,
  onLoadedMetadata,
  onError,
}: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const sentence = sentenceAtTime(lesson.sentences, currentTime);
  const total = duration || lesson.duration;
  const displayTime = isDragging ? dragValue : currentTime;
  const progress = total > 0 ? Math.min(100, (displayTime / total) * 100) : 0;

  useEffect(() => {
    if (isPlaying) setStarted(true);
  }, [isPlaying]);

  const handleCoverPlay = () => {
    setStarted(true);
    onTogglePlay();
  };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current.requestFullscreen?.();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !videoRef.current.muted;
    videoRef.current.muted = next;
    setMuted(next);
  };

  return (
    <div className={`video-shell ${isPlaying ? "is-playing" : ""}`} ref={stageRef}>
      <video
        ref={videoRef}
        className="lesson-video"
        src={withBasePath(lesson.videoSrc)}
        poster={withBasePath(lesson.poster)}
        preload="metadata"
        playsInline
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onError={onError}
        onClick={onTogglePlay}
      />

      <div className="video-topbar">
        <span className="video-kicker">
          <span className="rec-dot" />
          {lesson.imported ? "LOCAL LESSON" : "MINI-LESSON 01"}
        </span>
        <div className="video-top-actions">
          {!settings.showEnglish ? <span className="video-mode-pill">Listening</span> : null}
          <span className="video-level">{lesson.level ?? "B1–B2"}</span>
        </div>
      </div>

      {!started ? (
        <button type="button" className="video-cover" onClick={handleCoverPlay} aria-label="Play lesson">
          <span className="cover-wash" />
          <span className="cover-content">
            <span className="cover-play">
              <Play size={24} fill="currentColor" strokeWidth={1.2} />
            </span>
            <span className="cover-label">Play the lesson</span>
            <span className="cover-meta">
              {formatTime(total)} · {lesson.sentences.length} lines · {lesson.accent ?? "English"}
            </span>
          </span>
          <span className="cover-corner cover-corner-tl" />
          <span className="cover-corner cover-corner-br" />
        </button>
      ) : null}

      {started && !isPlaying ? (
        <button type="button" className="resume-button" onClick={onTogglePlay} aria-label="Resume lesson">
          <Play size={20} fill="currentColor" strokeWidth={1.4} />
        </button>
      ) : null}

      {started && sentence ? (
        <CaptionLine
          sentence={sentence}
          time={currentTime}
          showEnglish={settings.showEnglish}
          showChinese={settings.showChinese}
          onWordClick={onWordClick}
        />
      ) : null}

      <div className="video-controls" onClick={(event) => event.stopPropagation()}>
        <div className="progress-row">
          <span className="timecode">{formatTime(displayTime)}</span>
          <div className="progress-wrap">
            <input
              className="progress-range"
              type="range"
              min={0}
              max={Math.max(total, 0.1)}
              step={0.01}
              value={Math.min(displayTime, total)}
              onPointerDown={() => {
                setIsDragging(true);
                setDragValue(currentTime);
              }}
              onChange={(event) => {
                const nextVal = Number(event.target.value);
                setDragValue(nextVal);
                if (!isDragging) onSeek(nextVal);
              }}
              onPointerUp={() => {
                if (isDragging) {
                  setIsDragging(false);
                  onSeek(dragValue);
                }
              }}
              onPointerCancel={() => setIsDragging(false)}
              aria-label="Video progress"
              style={{
                background: `linear-gradient(to right, var(--coral) 0%, var(--coral) ${progress}%, rgba(255,255,255,.22) ${progress}%, rgba(255,255,255,.22) 100%)`,
              }}
            />
            {loopActive && sentence ? (
              <span
                className="loop-segment"
                style={{
                  left: `${(sentence.start / total) * 100}%`,
                  width: `${((sentence.end - sentence.start) / total) * 100}%`,
                }}
              />
            ) : null}
          </div>
          <span className="timecode timecode-muted">{formatTime(total)}</span>
        </div>
        <div className="control-row">
          <div className="control-group">
            <button type="button" className="icon-button" onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button type="button" className="icon-button" onClick={() => onSeek(currentTime - 5)} aria-label="Back 5 seconds">
              <RotateCcw size={18} />
            </button>
            <button type="button" className="icon-button" onClick={() => onSeek(currentTime + 5)} aria-label="Forward 5 seconds">
              <RotateCw size={18} />
            </button>
            <button
              type="button"
              className={`icon-button ${loopActive ? "is-on" : ""}`}
              onClick={onToggleLoop}
              aria-label="Loop current sentence"
              aria-pressed={loopActive}
            >
              <Repeat2 size={18} />
            </button>
            <button type="button" className="icon-button hide-mobile" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
          <div className="control-group control-group-right">
            <select
              className="speed-select"
              value={settings.rate}
              onChange={(event) => onRateChange(Number(event.target.value))}
              aria-label="Playback speed"
            >
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
            </select>
            <button
              type="button"
              className={`icon-button ${settings.showEnglish ? "" : "is-on"}`}
              onClick={onToggleEnglish}
              aria-label={settings.showEnglish ? "Hide subtitles" : "Show subtitles"}
              aria-pressed={!settings.showEnglish}
            >
              {settings.showEnglish ? <Captions size={19} /> : <CaptionsOff size={19} />}
            </button>
            <button type="button" className="icon-button" onClick={toggleFullscreen} aria-label="Fullscreen">
              <Expand size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
