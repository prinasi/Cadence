"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // A blocked or corrupt localStorage should never stop the lesson.
    } finally {
      setHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota errors are non-fatal in the local-first MVP.
    }
  }, [hydrated, key, value]);

  return [value, setValue, hydrated];
}

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export const STORAGE_KEYS = {
  items: "cadence:items:v1",
  attempts: "cadence:attempts:v1",
  settings: "cadence:settings:v1",
  lastImport: "cadence:last-import:v1",
} as const;

export const initialPlayerSettings = {
  showEnglish: true,
  showChinese: true,
  rate: 1,
};
