"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BookOpenText,
  CloudOff,
  Command,
  Headphones,
  Keyboard,
  LibraryBig,
  ListStart,
  LockKeyhole,
  Pause,
  Play,
  Repeat2,
  Sparkles,
  Subtitles,
  Upload,
  Volume2,
} from "lucide-react";
import type {
  DictionaryEntry,
  Exercise,
  ExerciseMode,
  FocusSelection,
  LearningItem,
  Lesson,
  PlayerSettings,
  PracticeAttempt,
  Sentence,
  WordToken,
} from "@/lib/types";
import { demoLesson } from "@/lib/demo";
import { getImportedLesson, saveImportedLesson, clearImportedLesson } from "@/lib/idb";
import {
  downloadTextFile,
  findSaved,
  findSavedInSentence,
  getTodayStats,
  itemsToCsv,
  makeLearningItem,
  makeManualLearningItem,
  updateItemPractice,
  typeLabel,
  type ManualItemDraft,
} from "@/lib/learning";
import { lookupLocalEntry } from "@/lib/dictionary";
import { initialPlayerSettings, STORAGE_KEYS, usePersistentState } from "@/lib/storage";
import {
  availableModes,
  exerciseForSavedItem,
  phraseExercise,
  sentenceExercise,
  wordExercise,
} from "@/lib/exercises";
import {
  activeWordIndex,
  findPhraseTokens,
  normalizeAnswer,
  normalizeWord,
  sentenceAtTime,
} from "@/lib/text";
import { Brand } from "./brand";
import { VideoStage } from "./video-stage";
import { TranscriptPanel } from "./transcript-panel";
import { Inspector } from "./inspector";
import { SessionCard } from "./session-card";
import { PracticeRoom } from "./practice-room";
import { NotebookDrawer } from "./notebook-drawer";
import { ImportDialog } from "./import-dialog";

type PracticeState = {
  open: boolean;
  mode: ExerciseMode;
  exercise: Exercise | null;
  startIndex: number;
};

function wordFocus(sentence: Sentence, token: WordToken): FocusSelection {
  return {
    type: "word",
    text: token.text,
    normalized: normalizeWord(token.text),
    sentence,
    token,
    start: token.start,
    end: token.end,
  };
}

function phraseFocus(sentence: Sentence, tokens: WordToken[]): FocusSelection {
  return {
    type: "phrase",
    text: tokens.map((token) => token.text).join(" "),
    normalized: normalizeAnswer(tokens.map((token) => token.text).join(" ")),
    sentence,
    tokens,
    start: tokens[0]?.start ?? sentence.start,
    end: tokens[tokens.length - 1]?.end ?? sentence.end,
  };
}

function sentenceFocus(sentence: Sentence): FocusSelection {
  return {
    type: "sentence",
    text: sentence.text,
    normalized: normalizeAnswer(sentence.text),
    sentence,
    start: sentence.start,
    end: sentence.end,
  };
}

function isFormTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}

export function StudyApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const loopTimer = useRef<number | null>(null);

  const [lesson, setLesson] = useState<Lesson>(demoLesson);
  const [focus, setFocus] = useState<FocusSelection | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(demoLesson.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [playRange, setPlayRange] = useState<{
    start: number;
    end: number;
    loop: boolean;
    kind: "sentence" | "practice" | "word";
  } | null>(null);
  const [practice, setPractice] = useState<PracticeState>({
    open: false,
    mode: "sentence",
    exercise: null,
    startIndex: 0,
  });
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [items, setItems, itemsReady] = usePersistentState<LearningItem[]>(STORAGE_KEYS.items, []);
  const [attempts, setAttempts, attemptsReady] = usePersistentState<PracticeAttempt[]>(STORAGE_KEYS.attempts, []);
  const [settings, setSettings, settingsReady] = usePersistentState<PlayerSettings>(
    STORAGE_KEYS.settings,
    initialPlayerSettings,
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    setSettings((previous) => ({ ...initialPlayerSettings, ...previous }));
  }, [settingsReady, setSettings]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (loopTimer.current) window.clearTimeout(loopTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getImportedLesson().then((record) => {
      if (cancelled || !record?.video) return;
      try {
        const url = URL.createObjectURL(record.video);
        objectUrlRef.current = url;
        setLesson({ ...record.lesson, videoSrc: url });
        setDuration(record.lesson.duration);
        notify("Restored your last local lesson");
      } catch {
        // A stale blob should not block the demo.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [notify]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setPlayRange(null);
    setDuration(lesson.duration);
  }, [lesson.id, lesson.duration]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = settings.rate;
  }, [settings.rate, lesson.id]);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const video = videoRef.current;
      if (video) {
        if (!video.paused && now - last > 55) {
          setCurrentTime(video.currentTime);
          last = now;
        }
        if (playRange && !video.paused && video.currentTime >= playRange.end) {
          if (playRange.loop) {
            video.pause();
            if (loopTimer.current) window.clearTimeout(loopTimer.current);
            loopTimer.current = window.setTimeout(() => {
              const currentVideo = videoRef.current;
              if (currentVideo && playRange?.loop) {
                currentVideo.currentTime = playRange.start;
                void currentVideo.play().catch(() => undefined);
              }
            }, 650);
          } else {
            video.pause();
            setPlayRange(null);
            setClipPlaying(false);
          }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      if (loopTimer.current) window.clearTimeout(loopTimer.current);
    };
  }, [playRange]);

  const today = useMemo(() => getTodayStats(attempts), [attempts]);
  const currentSentence = useMemo(
    () => sentenceAtTime(lesson.sentences, currentTime),
    [lesson.sentences, currentTime],
  );
  const currentSentenceId = currentSentence?.id;
  const activeWordId = useMemo(() => {
    if (focus?.type === "word" && focus.sentence.id === currentSentence?.id) return focus.token.id;
    if (!currentSentence) return undefined;
    const index = activeWordIndex(currentSentence, currentTime);
    return index >= 0 ? currentSentence.words[index]?.id : undefined;
  }, [currentSentence, currentTime, focus]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      const bounded = Math.max(0, Math.min(time, duration || lesson.duration));
      setPlayRange(null);
      if (video) video.currentTime = bounded;
      setCurrentTime(bounded);
    },
    [duration, lesson.duration],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setPlayRange(null);
      if (video.currentTime >= (duration || lesson.duration) - 0.08) video.currentTime = 0;
      void video.play().catch(() => notify("Your browser blocked playback. Press play again."));
    } else {
      video.pause();
    }
  }, [duration, lesson.duration, notify]);

  const playClip = useCallback(
    (start: number, end: number, rate = 1, kind: "sentence" | "practice" | "word" = "practice", loop = false) => {
      const video = videoRef.current;
      if (!video) return;
      if (loopTimer.current) {
        window.clearTimeout(loopTimer.current);
        loopTimer.current = null;
      }
      const safeStart = Math.max(0, start);
      const safeEnd = Math.max(safeStart + 0.12, Math.min(end, duration || lesson.duration));
      video.currentTime = safeStart;
      video.playbackRate = rate;
      setPlayRange({ start: safeStart, end: safeEnd, loop, kind });
      setCurrentTime(safeStart);
      setClipPlaying(true);
      void video.play().catch(() => {
        setClipPlaying(false);
        notify("Playback was blocked. Press play once to allow audio.");
      });
    },
    [duration, lesson.duration, notify],
  );

  const stopClip = useCallback(() => {
    if (loopTimer.current) {
      window.clearTimeout(loopTimer.current);
      loopTimer.current = null;
    }
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    setPlayRange(null);
    setClipPlaying(false);
  }, []);

  const pauseVideo = useCallback(() => {
    if (loopTimer.current) {
      window.clearTimeout(loopTimer.current);
      loopTimer.current = null;
    }
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    stopClip();
  }, [stopClip]);

  const toggleLoop = useCallback(() => {
    if (!currentSentence) return;
    if (loopTimer.current) {
      window.clearTimeout(loopTimer.current);
      loopTimer.current = null;
    }
    if (playRange?.loop) {
      setPlayRange(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const safeStart = Math.max(0, currentSentence.start - 0.08);
    const safeEnd = Math.min(duration || lesson.duration, currentSentence.end + 0.2);
    if (video.currentTime < safeStart || video.currentTime > safeEnd) {
      video.currentTime = safeStart;
    }
    setPlayRange({
      start: safeStart,
      end: safeEnd,
      loop: true,
      kind: "sentence",
    });
    void video.play().catch(() => undefined);
  }, [currentSentence, playRange?.loop, duration, lesson.duration]);

  const handleRateChange = useCallback(
    (rate: number) => {
      setSettings((previous) => ({ ...previous, rate }));
      if (videoRef.current) videoRef.current.playbackRate = rate;
    },
    [setSettings],
  );

  const toggleEnglish = useCallback(() => {
    setSettings((previous) => ({ ...previous, showEnglish: !previous.showEnglish }));
  }, [setSettings]);

  const toggleChinese = useCallback(() => {
    setSettings((previous) => ({ ...previous, showChinese: !previous.showChinese }));
  }, [setSettings]);

  const openPractice = useCallback(
    (mode: ExerciseMode, exercise: Exercise | null = null, startIndex = 0) => {
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      stopClip();
      setPractice({ open: true, mode, exercise, startIndex });
    },
    [stopClip],
  );

  const startPractice = useCallback(
    (preferred: ExerciseMode = "sentence", startIndex = 0) => {
      const counts = availableModes(lesson, items);
      const mode =
        counts[preferred] > 0
          ? preferred
          : counts.word > 0
            ? "word"
            : counts.phrase > 0
              ? "phrase"
              : "sentence";
      openPractice(mode, null, mode === "sentence" ? startIndex : 0);
    },
    [items, lesson, openPractice],
  );

  const practiceFocus = useCallback(
    (selection: FocusSelection) => {
      if (selection.type === "word") {
        openPractice("word", wordExercise(selection.sentence, selection.token));
      } else if (selection.type === "phrase") {
        openPractice("phrase", phraseExercise(selection.sentence, selection.tokens));
      } else {
        openPractice("sentence", sentenceExercise(selection.sentence));
      }
    },
    [openPractice],
  );

  const closeNotebook = useCallback(() => setNotebookOpen(false), []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  const closePractice = useCallback(() => {
    stopClip();
    setPractice((previous) => ({ ...previous, open: false }));
    if (videoRef.current) videoRef.current.playbackRate = settings.rate;
  }, [settings.rate, stopClip]);

  const handleAttempt = useCallback(
    (attempt: PracticeAttempt) => {
      setAttempts((previous) => [attempt, ...previous].slice(0, 2000));
      setItems((previous) => updateItemPractice(previous, attempt));
    },
    [setAttempts, setItems],
  );

  const orientToSentence = useCallback((sentence: Sentence) => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    if (video.currentTime < sentence.start || video.currentTime > sentence.end + 0.1) {
      video.currentTime = sentence.start;
      setCurrentTime(sentence.start);
      setPlayRange(null);
    }
  }, []);

  const selectWord = useCallback(
    (sentence: Sentence, token: WordToken) => {
      orientToSentence(sentence);
      setFocus(wordFocus(sentence, token));
    },
    [orientToSentence],
  );

  const selectPhrase = useCallback(
    (sentence: Sentence, tokens: WordToken[]) => {
      orientToSentence(sentence);
      setFocus(phraseFocus(sentence, tokens));
    },
    [orientToSentence],
  );

  const selectSentence = useCallback(
    (sentence: Sentence) => {
      orientToSentence(sentence);
      setFocus(sentenceFocus(sentence));
      if (playRange?.loop) {
        const safeStart = Math.max(0, sentence.start - 0.08);
        const safeEnd = Math.min(duration || lesson.duration, sentence.end + 0.2);
        setPlayRange({ start: safeStart, end: safeEnd, loop: true, kind: "sentence" });
        if (videoRef.current) {
          videoRef.current.currentTime = safeStart;
          void videoRef.current.play().catch(() => undefined);
        }
      }
    },
    [orientToSentence, playRange?.loop, duration, lesson.duration],
  );

  const focusPhrase = useCallback((sentence: Sentence, tokens: WordToken[]) => {
    setFocus(phraseFocus(sentence, tokens));
  }, []);

  const toggleSave = useCallback(
    (selection: FocusSelection, entry: DictionaryEntry | null) => {
      const existing = findSavedInSentence(items, selection.type, selection.text, selection.sentence.id);
      if (existing) {
        setItems((previous) => previous.filter((item) => item.id !== existing.id));
        notify(`Removed “${selection.text}” from this line`);
        return;
      }
      const item = makeLearningItem(selection, entry, lesson);
      setItems((previous) => [item, ...previous]);
      notify(`${typeLabel(selection.type)} saved with its line and timestamp`);
    },
    [items, lesson, notify, setItems],
  );

  const saveWordFromPractice = useCallback(
    (sentence: Sentence, token: WordToken, entry: DictionaryEntry | null) => {
      toggleSave(wordFocus(sentence, token), entry);
    },
    [toggleSave],
  );

  const saveSentenceFromPractice = useCallback(
    (sentence: Sentence) => {
      toggleSave(sentenceFocus(sentence), null);
    },
    [toggleSave],
  );

  const savePhraseFromPractice = useCallback(
    (sentence: Sentence, tokens: WordToken[]) => {
      toggleSave(phraseFocus(sentence, tokens), null);
    },
    [toggleSave],
  );

  const deleteItem = useCallback(
    (item: LearningItem) => {
      setItems((previous) => previous.filter((candidate) => candidate.id !== item.id));
      notify(`Removed “${item.text}”`);
    },
    [notify, setItems],
  );

  const jumpToItem = useCallback(
    (item: LearningItem) => {
      if (item.context.lessonId !== lesson.id) {
        notify("That item belongs to a different lesson");
        return;
      }
      const sentence = lesson.sentences.find((candidate) => candidate.id === item.context.sentenceId);
      if (!sentence) {
        notify("The original line is no longer in this lesson");
        return;
      }
      if (item.type === "word") {
        const token = sentence.words.find((candidate) => normalizeWord(candidate.text) === item.normalized);
        if (token) setFocus(wordFocus(sentence, token));
        else setFocus(sentenceFocus(sentence));
      } else if (item.type === "phrase") {
        const tokens = findPhraseTokens(sentence, item.text);
        if (tokens.length >= 2) setFocus(phraseFocus(sentence, tokens));
        else setFocus(sentenceFocus(sentence));
      } else {
        setFocus(sentenceFocus(sentence));
      }
      setNotebookOpen(false);
      playClip(item.context.start, item.context.end, 1, "sentence");
    },
    [lesson, notify, playClip],
  );

  const practiceSavedItem = useCallback(
    (item: LearningItem) => {
      const exercise = exerciseForSavedItem(item, lesson);
      if (!exercise) {
        notify("This item cannot be rebuilt from the current lesson");
        return;
      }
      setNotebookOpen(false);
      openPractice(item.type, exercise);
    },
    [lesson, notify, openPractice],
  );

  const importLesson = useCallback(
    async (nextLesson: Lesson, video: Blob) => {
      stopClip();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = nextLesson.videoSrc;
      } else {
        objectUrlRef.current = nextLesson.videoSrc;
      }
      setLesson(nextLesson);
      setFocus(null);
      setPractice({ open: false, mode: "sentence", exercise: null, startIndex: 0 });
      setCurrentTime(0);
      setDuration(nextLesson.duration);
      setImportOpen(false);
      try {
        await saveImportedLesson(nextLesson, video);
        notify("Lesson imported. Video and subtitles stay on this device.");
      } catch {
        notify("Lesson ready for this session, but the browser could not persist the video.");
      }
    },
    [notify, stopClip],
  );

  const resetToDemo = useCallback(() => {
    stopClip();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    void clearImportedLesson();
    setLesson(demoLesson);
    setFocus(null);
    setPractice({ open: false, mode: "sentence", exercise: null, startIndex: 0 });
    setCurrentTime(0);
    setDuration(demoLesson.duration);
    setNotebookOpen(false);
    notify("Back to the original demo lesson");
  }, [notify, stopClip]);

  const addManualItem = useCallback(
    (draft: ManualItemDraft) => {
      const text = draft.text.trim();
      if (!text) return false;
      if (findSaved(items, draft.type, text)) {
        notify(`“${text}” is already in your notebook`);
        return false;
      }
      const sentence = currentSentence ?? lesson.sentences[0];
      if (!sentence) return false;
      const entry = lookupLocalEntry(text, draft.type);
      const item = makeManualLearningItem({ ...draft, text }, lesson, sentence, entry);
      setItems((previous) => [item, ...previous]);
      notify(`${typeLabel(draft.type)} added to your notebook`);
      return true;
    },
    [currentSentence, items, lesson, notify, setItems],
  );

  const exportNotebookCsv = useCallback(() => {
    if (!items.length) return;
    downloadTextFile("cadence-notebook.csv", itemsToCsv(items), "text/csv;charset=utf-8");
    notify("Notebook exported as CSV");
  }, [items, notify]);

  const exportNotebook = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            lesson: { id: lesson.id, title: lesson.title },
            items,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cadence-notebook.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Notebook exported as JSON");
  }, [items, lesson.id, lesson.title, notify]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (practice.open || notebookOpen || importOpen) return;
      if (isFormTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const onNativeControl = Boolean(target?.closest("button, [role='button']"));
      if (onNativeControl && (event.key === " " || event.key === "Enter")) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seek(currentTime - 5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seek(currentTime + 5);
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        toggleEnglish();
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        toggleLoop();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    currentTime,
    importOpen,
    notebookOpen,
    practice.open,
    seek,
    toggleEnglish,
    toggleLoop,
    togglePlay,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!focus || window.innerWidth <= 1080) return;
    document.querySelector(".rail")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [focus]);

  useEffect(() => {
    if (!notebookOpen && !importOpen) return;
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
  }, [importOpen, notebookOpen]);

  const isLooping = Boolean(playRange?.loop && playRange.kind === "sentence");
  const wordCount = lesson.sentences.reduce((total, sentence) => total + sentence.words.length, 0);
  const headerTitle = lesson.title;
  const inspectorFocus = focus;

  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand />
        <nav className="header-nav" aria-label="Primary">
          <button type="button" className="nav-link is-active">
            <LibraryBig size={15} />
            Study
          </button>
          <button type="button" className="nav-link" onClick={() => setNotebookOpen(true)}>
            <BookOpenText size={15} />
            Notebook
            {items.length ? <span className="nav-count">{items.length}</span> : null}
          </button>
        </nav>
        <div className="header-actions">
          <span className="local-pill" title="This prototype keeps learning data in this browser">
            <CloudOff size={13} />
            Local-first
          </span>
          <button type="button" className="button button-ghost header-import" onClick={() => setImportOpen(true)}>
            <Upload size={15} />
            Import lesson
          </button>
          <button
            type="button"
            className="notebook-button"
            onClick={() => setNotebookOpen(true)}
            aria-label="Open notebook"
          >
            <BookOpenText size={17} />
            {items.length ? <span>{items.length > 99 ? "99+" : items.length}</span> : null}
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="main-column">
          <section className="lesson-hero">
            <div className="lesson-eyebrow">
              <span className="eyebrow-rule" />
              <span>{lesson.imported ? "Your material" : "Mini-lesson 01"}</span>
              <span className="eyebrow-dot" />
              <span>{lesson.accent ?? "General American"}</span>
            </div>
            <div className="lesson-title-row">
              <div className="lesson-title-copy">
                <h1>{headerTitle}</h1>
                <p>{lesson.subtitle ?? "A short listening lesson built around one real piece of English."}</p>
              </div>
              <div className="lesson-facts">
                <span>{lesson.level ?? "B1–B2"}</span>
                <span>{wordCount} words</span>
                <span>{lesson.sentences.length} lines</span>
              </div>
            </div>
            <div className="lesson-actions">
              <button type="button" className="button button-coral" onClick={() => startPractice("sentence")}>
                <Headphones size={15} />
                Start line dictation
              </button>
              <button
                type="button"
                className="button button-soft"
                onClick={() => currentSentence && setFocus(sentenceFocus(currentSentence))}
                disabled={!currentSentence}
              >
                <Subtitles size={15} />
                Study this line
              </button>
              <span className="lesson-source">
                {lesson.imported ? "Imported locally" : "Original narration"} ·{" "}
                {lesson.alignment === "exact" ? "word-level timing" : "estimated word timing"}
              </span>
            </div>
          </section>

          <VideoStage
            key={lesson.id}
            videoRef={videoRef}
            lesson={lesson}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            settings={settings}
            loopActive={isLooping}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onRateChange={handleRateChange}
            onToggleEnglish={toggleEnglish}
            onToggleLoop={toggleLoop}
            onWordClick={selectWord}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setPlayRange(null);
            }}
            onLoadedMetadata={() => {
              const video = videoRef.current;
              if (!video) return;
              if (Number.isFinite(video.duration)) setDuration(video.duration);
              video.playbackRate = settings.rate;
            }}
            onError={() => notify("This video could not be loaded. Try re-importing the file.")}
          />

          <div className="lesson-ribbon">
            <div className="ribbon-now">
              <span className="ribbon-dot" />
              <span className="ribbon-label">Now</span>
              <span className="ribbon-line">
                Line {String((currentSentence?.index ?? 0) + 1).padStart(2, "0")} /{" "}
                {String(lesson.sentences.length).padStart(2, "0")}
              </span>
              <span className="ribbon-divider" />
              <span className="ribbon-translation">
                {settings.showChinese
                  ? currentSentence?.translation ?? "No translation for this line"
                  : "Chinese translation is hidden"}
              </span>
            </div>
            <div className="ribbon-actions">
              <button type="button" className={`ribbon-button ${isLooping ? "is-on" : ""}`} onClick={toggleLoop}>
                <Repeat2 size={14} />
                {isLooping ? "Looping line" : "Loop line"}
              </button>
              <button
                type="button"
                className="ribbon-button"
                onClick={() => currentSentence && openPractice("sentence", sentenceExercise(currentSentence))}
                disabled={!currentSentence}
              >
                <Headphones size={14} />
                Dictate this line
              </button>
              <button
                type="button"
                className="ribbon-button"
                onClick={() => currentSentence && startPractice("sentence", currentSentence.index)}
                disabled={!currentSentence}
                title="Start line dictation from this sentence"
              >
                <ListStart size={14} />
                Start here
              </button>
            </div>
          </div>

          <TranscriptPanel
            sentences={lesson.sentences}
            currentSentenceId={currentSentenceId}
            currentTime={currentTime}
            activeWordId={activeWordId}
            showEnglish={settings.showEnglish}
            showChinese={settings.showChinese}
            onToggleEnglish={toggleEnglish}
            onToggleChinese={toggleChinese}
            onSeek={seek}
            onWordClick={selectWord}
            onPhraseSelect={selectPhrase}
            onSaveSentence={selectSentence}
          />

          <section className="method-strip" id="method">
            <div className="method-intro">
              <p className="section-kicker">The study loop</p>
              <h2>One line, three passes.</h2>
              <p>
                Watch for meaning. Keep what matters. Then return to the same voice and rebuild it from sound — no
                context-free word lists.
              </p>
            </div>
            <div className="method-steps">
              <div>
                <span>01</span>
                <strong>Notice</strong>
                <p>Karaoke timing keeps your eyes on the words as they arrive.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Keep</strong>
                <p>Words, phrases, and lines save with their original timestamp.</p>
              </div>
              <div>
                <span>03</span>
                <strong>Recall</strong>
                <p>Dictation hides the answer and asks you to reconstruct the sound.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="rail">
          <Inspector
            focus={inspectorFocus}
            lesson={lesson}
            currentSentence={currentSentence}
            savedItems={items}
            today={today}
            onClose={() => setFocus(null)}
            onToggleSave={toggleSave}
            onPractice={practiceFocus}
            onPlayRange={(start, end, kind) => playClip(start, end, 1, kind)}
            onSentenceFocus={selectSentence}
            onPhraseFocus={focusPhrase}
            onOpenNotebook={() => setNotebookOpen(true)}
            onStartPractice={() => startPractice("sentence")}
            onPronounceStart={pauseVideo}
          />

          <SessionCard
            lesson={lesson}
            items={items}
            today={today}
            onStartPractice={() => startPractice("sentence")}
            onOpenNotebook={() => setNotebookOpen(true)}
            onResetToDemo={resetToDemo}
          />

          <div className="shortcut-card">
            <div className="shortcut-head">
              <Keyboard size={15} />
              <span>Keyboard</span>
            </div>
            <div className="shortcut-row">
              <span><kbd>Space</kbd> play / pause</span>
              <span><kbd>←</kbd><kbd>→</kbd> 5 seconds</span>
              <span><kbd>C</kbd> subtitles</span>
              <span><kbd>L</kbd> loop line</span>
            </div>
          </div>
        </aside>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <Brand compact />
          <p>A local-first prototype for learning English from the things worth hearing.</p>
        </div>
        <div className="footer-note">
          <span><LockKeyhole size={13} /> Video and notes stay in this browser</span>
          <span><Volume2 size={13} /> Built for headphones</span>
          <span><Command size={13} /> Space to play, C for captions</span>
        </div>
      </footer>

      <div className="mobile-dock">
        <button type="button" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <button type="button" onClick={() => startPractice("sentence")}>
          <Headphones size={18} />
          Dictation
        </button>
        <button type="button" onClick={() => setNotebookOpen(true)}>
          <BookOpenText size={18} />
          Notebook
        </button>
      </div>

      {practice.open ? (
        <PracticeRoom
          key={`${lesson.id}-${practice.mode}-${practice.exercise?.id ?? "round"}-${practice.startIndex}`}
          lesson={lesson}
          savedItems={items}
          initialMode={practice.mode}
          initialExercise={practice.exercise}
          initialStartIndex={practice.startIndex}
          isClipPlaying={clipPlaying}
          onClose={closePractice}
          onPlayClip={(start, end, rate) => playClip(start, end, rate, "practice")}
          onStopClip={stopClip}
          onAttempt={handleAttempt}
          onSaveWord={saveWordFromPractice}
          onSaveSentence={saveSentenceFromPractice}
          onSavePhrase={savePhraseFromPractice}
          onPronounceStart={pauseVideo}
        />
      ) : null}

      <NotebookDrawer
        open={notebookOpen}
        lesson={lesson}
        items={items}
        onClose={closeNotebook}
        onJump={jumpToItem}
        onDelete={deleteItem}
        onPractice={practiceSavedItem}
        onExport={exportNotebook}
        onExportCsv={exportNotebookCsv}
        onAddManual={addManualItem}
        currentSentence={currentSentence}
        onStartPractice={() => {
          setNotebookOpen(false);
          startPractice("sentence");
        }}
      />

      <ImportDialog open={importOpen} onClose={closeImport} onImported={importLesson} />

      {toast ? (
        <div className="toast" role="status">
          <Sparkles size={15} />
          {toast}
        </div>
      ) : null}

      {!itemsReady || !attemptsReady ? <span className="hydration-note">loading local notebook…</span> : null}
    </div>
  );
}
