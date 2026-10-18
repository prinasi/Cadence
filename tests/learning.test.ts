import { describe, expect, it } from "vitest";
import { demoLesson } from "@/lib/demo";
import { lookupLocalEntry } from "@/lib/dictionary";
import {
  itemsToCsv,
  makeManualLearningItem,
  type ManualItemDraft,
} from "@/lib/learning";

const draft: ManualItemDraft = {
  type: "word",
  text: "deliberate",
  translation: "故意的；刻意的",
};

describe("manual notebook items", () => {
  it("builds a manual item against the current line", () => {
    const sentence = demoLesson.sentences[2];
    const item = makeManualLearningItem(draft, demoLesson, sentence);
    expect(item.type).toBe("word");
    expect(item.normalized).toBe("deliberate");
    expect(item.translation).toBe("故意的；刻意的");
    expect(item.context.sentenceId).toBe(sentence.id);
    expect(item.context.lessonId).toBe(demoLesson.id);
    expect(item.practice.attempts).toBe(0);
  });

  it("uses a local dictionary entry when one exists", () => {
    const sentence = demoLesson.sentences[1];
    const item = makeManualLearningItem(
      { type: "word", text: "progress" },
      demoLesson,
      sentence,
      lookupLocalEntry("progress", "word"),
    );
    expect(item.phonetic).toBeTruthy();
    expect(item.translation).toContain("进步");
  });

  it("exports a CSV with escaped text and all core fields", () => {
    const sentence = demoLesson.sentences[0];
    const item = makeManualLearningItem(
      { type: "sentence", text: 'He said "hello", then left.', translation: "他说“你好”，然后离开了。" },
      demoLesson,
      sentence,
    );
    const csv = itemsToCsv([item]);
    expect(csv).toContain('"type","text","translation"');
    expect(csv).toContain('"He said ""hello"", then left."');
    expect(csv).toContain('"sentence"');
    expect(csv).toContain('"0.000"');
  });
});
