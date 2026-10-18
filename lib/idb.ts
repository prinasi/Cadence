"use client";

import type { Lesson } from "./types";

const DB_NAME = "cadence-local";
const STORE_NAME = "lessons";
const DB_VERSION = 1;
const LAST_KEY = "last-import";

export type StoredLesson = {
  id: string;
  lesson: Lesson;
  video: Blob | null;
  createdAt: string;
};

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

export async function saveImportedLesson(lesson: Lesson, video: Blob | null): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      id: LAST_KEY,
      lesson: { ...lesson, videoSrc: "" },
      video,
      createdAt: new Date().toISOString(),
    } satisfies StoredLesson);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save lesson"));
  });
  db.close();
}

export async function getImportedLesson(): Promise<StoredLesson | null> {
  if (!hasIndexedDb()) return null;
  try {
    const db = await openDatabase();
    const record = await new Promise<StoredLesson | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(LAST_KEY);
      request.onsuccess = () => resolve((request.result as StoredLesson | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read lesson"));
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function clearImportedLesson(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(LAST_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Ignore cleanup failures.
  }
}
