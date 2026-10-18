"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  FileVideo,
  Film,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import type { Lesson } from "@/lib/types";
import { parseSubtitle, buildLessonFromSubtitle } from "@/lib/subtitles";
import {
  isMatroskaFile,
  isSupportedVideoFile,
  probeVideoPlayback,
  VIDEO_ACCEPT,
  videoProbeMessage,
} from "@/lib/video";

type ImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onImported: (lesson: Lesson, video: Blob) => Promise<void>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatProbeDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

type VideoProbeState =
  | { status: "checking" }
  | { status: "ok"; duration: number }
  | { status: "error"; message: string };

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the subtitle file."));
    reader.readAsText(file);
  });
}

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const videoInput = useRef<HTMLInputElement>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleText, setSubtitleText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [dragTarget, setDragTarget] = useState<"video" | "subtitle" | null>(null);
  const [videoProbe, setVideoProbe] = useState<VideoProbeState | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, working]);

  useEffect(() => {
    if (!videoFile) {
      setVideoProbe(null);
      return;
    }
    let cancelled = false;
    setVideoProbe({ status: "checking" });
    probeVideoPlayback(videoFile).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setVideoProbe({ status: "ok", duration: result.duration });
      } else {
        setVideoProbe({ status: "error", message: videoProbeMessage(videoFile, result) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [videoFile]);

  const preview = useMemo(() => {
    if (!subtitleText) return null;
    try {
      const cues = parseSubtitle(subtitleText);
      return { cues: cues.length, first: cues[0]?.text ?? "", error: "" };
    } catch {
      return { cues: 0, first: "", error: "Could not parse this subtitle file." };
    }
  }, [subtitleText]);

  const reset = () => {
    setVideoFile(null);
    setSubtitleFile(null);
    setSubtitleText("");
    setTitle("");
    setError("");
    setWorking(false);
    setVideoProbe(null);
    if (videoInput.current) videoInput.current.value = "";
    if (subtitleInput.current) subtitleInput.current.value = "";
  };

  const close = () => {
    if (working) return;
    reset();
    onClose();
  };

  const chooseVideo = async (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedVideoFile(file)) {
      setError("Choose a video file (MP4, WebM, MOV, M4V, or MKV).");
      return;
    }
    setVideoFile(file);
    setError("");
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const chooseSubtitle = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setError("Choose an SRT or VTT subtitle file.");
      return;
    }
    try {
      const text = await readText(file);
      if (!text.trim()) {
        setError("That subtitle file is empty.");
        return;
      }
      const parsed = parseSubtitle(text);
      if (!parsed.length) {
        setError("No timed cues were found. Try exporting the subtitles again as SRT.");
        return;
      }
      setSubtitleFile(file);
      setSubtitleText(text);
      setError("");
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read the subtitle file.");
    }
  };

  const handleDrop = (event: React.DragEvent, target: "video" | "subtitle") => {
    event.preventDefault();
    setDragTarget(null);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (target === "video") void chooseVideo(file);
    else void chooseSubtitle(file);
  };

  const importLesson = async () => {
    if (!videoFile || !subtitleText || !videoProbe || videoProbe.status !== "ok" || working) return;
    setWorking(true);
    setError("");
    try {
      const videoSrc = URL.createObjectURL(videoFile);
      const lesson = buildLessonFromSubtitle({
        title: title.trim() || videoFile.name.replace(/\.[^.]+$/, ""),
        subtitleText,
        subtitleName: subtitleFile?.name,
        videoSrc,
        duration: videoProbe.duration,
      });
      await onImported(lesson, videoFile);
      reset();
      onClose();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "The lesson could not be imported.");
    } finally {
      setWorking(false);
    }
  };

  if (!open) return null;

  const ready = Boolean(videoFile && subtitleText && preview?.cues && videoProbe?.status === "ok");

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Import a lesson">
      <button type="button" className="modal-backdrop" onClick={close} aria-label="Close import dialog" />
      <div className="import-modal">
        <header className="import-header">
          <div>
            <p className="section-kicker">Bring your own material</p>
            <h2>Import a video lesson.</h2>
          </div>
          <button type="button" className="icon-close" onClick={close} aria-label="Close import dialog" disabled={working}>
            <X size={19} />
          </button>
        </header>

        <div className="import-body">
          <div className="import-main">
            <div className="import-step-row">
              <span className="import-step is-done">
                <i>1</i> Video
              </span>
              <span className="step-rule" />
              <span className={`import-step ${subtitleText ? "is-done" : ""}`}>
                <i>2</i> Subtitles
              </span>
              <span className="step-rule" />
              <span className={`import-step ${ready ? "is-done" : ""}`}>
                <i>3</i> Ready
              </span>
            </div>

            <button
              type="button"
              className={`drop-zone ${videoFile ? "has-file" : ""} ${dragTarget === "video" ? "is-dragging" : ""}`}
              onClick={() => videoInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragTarget("video");
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(event) => handleDrop(event, "video")}
            >
              <input
                ref={videoInput}
                type="file"
                accept={VIDEO_ACCEPT}
                hidden
                onChange={(event) => void chooseVideo(event.target.files?.[0])}
              />
              <span className="drop-icon">
                {videoFile ? <FileVideo size={22} /> : <UploadCloud size={22} />}
              </span>
              <span className="drop-copy">
                <strong>{videoFile ? videoFile.name : "Choose a local video"}</strong>
                <small>
                  {videoFile
                    ? `${formatBytes(videoFile.size)} · click to replace`
                    : "MP4, WebM, MOV, M4V or MKV · stays on your device"}
                </small>
              </span>
              {videoFile ? <CheckCircle2 size={19} className="drop-check" /> : <span className="drop-action">Browse</span>}
            </button>

            {videoFile && videoProbe ? (
              <div
                className={`video-probe ${
                  videoProbe.status === "checking"
                    ? "is-checking"
                    : videoProbe.status === "ok"
                      ? "is-ok"
                      : "is-error"
                }`}
                role="status"
              >
                {videoProbe.status === "checking" ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    Checking browser playback…
                  </>
                ) : videoProbe.status === "ok" ? (
                  <>
                    <CheckCircle2 size={14} />
                    Playback check passed · {formatProbeDuration(videoProbe.duration)}
                    {isMatroskaFile(videoFile) ? " · MKV" : ""}
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} />
                    <span>{videoProbe.message}</span>
                  </>
                )}
              </div>
            ) : null}

            <button
              type="button"
              className={`drop-zone ${subtitleFile ? "has-file" : ""} ${dragTarget === "subtitle" ? "is-dragging" : ""}`}
              onClick={() => subtitleInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragTarget("subtitle");
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(event) => handleDrop(event, "subtitle")}
            >
              <input
                ref={subtitleInput}
                type="file"
                accept=".srt,.vtt,text/vtt,application/x-subrip"
                hidden
                onChange={(event) => void chooseSubtitle(event.target.files?.[0])}
              />
              <span className="drop-icon">
                {subtitleFile ? <FileText size={22} /> : <Film size={22} />}
              </span>
              <span className="drop-copy">
                <strong>{subtitleFile ? subtitleFile.name : "Add English subtitles"}</strong>
                <small>
                  {subtitleFile
                    ? `${formatBytes(subtitleFile.size)} · ${preview?.cues ?? 0} timed cues`
                    : "SRT or VTT · sentence-level timing is enough"}
                </small>
              </span>
              {subtitleFile ? <CheckCircle2 size={19} className="drop-check" /> : <span className="drop-action">Browse</span>}
            </button>

            <label className="title-field">
              <span>Lesson title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. My favourite TED talk"
              />
            </label>

            {preview ? (
              <div className="subtitle-preview">
                <div>
                  <span className="preview-label">Parsed preview</span>
                  <strong>{preview.cues} cues detected</strong>
                </div>
                <p>“{preview.first}”</p>
              </div>
            ) : null}

            {error ? (
              <div className="import-error">
                <AlertCircle size={16} />
                {error}
              </div>
            ) : null}

            <div className="import-actions">
              <button type="button" className="text-button" onClick={close} disabled={working}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-coral"
                onClick={() => void importLesson()}
                disabled={!ready || working}
              >
                {working || (videoFile && videoProbe?.status === "checking") ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                {working
                  ? "Preparing lesson…"
                  : videoFile && videoProbe?.status === "checking"
                    ? "Checking video…"
                    : "Start learning"}
              </button>
            </div>
          </div>

          <aside className="import-aside">
            <div className="import-aside-block">
              <span className="aside-icon">
                <ShieldCheck size={18} />
              </span>
              <h3>Local by design.</h3>
              <p>
                Your video is kept in this browser’s storage and is never uploaded by this demo. Clearing site data removes
                it.
              </p>
            </div>
            <div className="import-aside-block">
              <h3>What happens to the timing?</h3>
              <p>
                Sentence timings come directly from the SRT/VTT. Word timings are estimated between cue edges and labelled
                “estimated” in the transcript.
              </p>
            </div>
            <div className="import-aside-block import-roadmap">
              <span className="roadmap-pill">Next up</span>
              <h3>Links & auto-transcription.</h3>
              <p>
                YouTube embeds, caption retrieval, and WhisperX word alignment are roadmap items — deliberately outside
                this first local-only slice.
              </p>
            </div>
            <div className="import-footnote">
              <p>Best result: 16:9 video + clean English SRT.</p>
              <p>MKV is accepted, but the browser must support the codecs inside it. H.264/AAC is the safest combination.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
