import demoJson from "@/content/demo-lesson.json";
import type { Lesson } from "./types";

export const demoLesson = demoJson as unknown as Lesson;

export const demoWordCount = demoLesson.sentences.reduce(
  (total, sentence) => total + sentence.words.length,
  0,
);
