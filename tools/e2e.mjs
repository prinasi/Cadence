import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3010";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
fs.mkdirSync("screenshots", { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

// Phrase selection through a real DOM range (same path as a drag).
await page.locator(".transcript-line").nth(1).scrollIntoViewIfNeeded();
await page.evaluate(() => {
  const line = document.querySelectorAll(".transcript-line")[1];
  const tokens = line.querySelectorAll("[data-token-id]");
  const range = document.createRange();
  range.setStartBefore(tokens[1]);
  range.setEndAfter(tokens[2]);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  line.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
});
await page.waitForTimeout(300);
const phrase = await page.locator(".dictionary-headword h2").textContent();
assert.equal(phrase.trim(), "real progress");
await page.screenshot({ path: "screenshots/phrase.png" });
console.log("phrase selection OK:", phrase.trim());

// Practice a phrase, deliberately misspell it, inspect the diff, finish the round.
await page.locator(".dictionary-actions .button-ghost").click();
await page.waitForTimeout(500);
await page.locator(".answer-input").fill("real progres");
await page.getByRole("button", { name: /Check answer/ }).click();
await page.waitForTimeout(300);
assert.match(await page.locator(".feedback-heading strong").textContent(), /Close|Not quite/);
assert.ok((await page.locator(".feedback-word.is-extra").allTextContents()).includes("progres"));
assert.ok((await page.locator(".missing-word").allTextContents()).includes("progress"));
assert.match(await page.locator(".correct-sentence-block p").textContent(), /real progress/);
await page.screenshot({ path: "screenshots/phrase-feedback.png" });
await page.getByRole("button", { name: /See summary/ }).click();
await page.waitForTimeout(400);
assert.equal(await page.locator(".summary-kicker").textContent().then((t) => t.trim()), "Round complete");
await page.screenshot({ path: "screenshots/summary.png" });
console.log("wrong-answer diff and summary OK");
await page.locator(".practice-summary .button-ghost-light").click();
await page.waitForTimeout(300);

// Save a word, then jump back from the notebook.
await page.locator(".word-token", { hasText: "progress" }).first().click();
await page.getByRole("button", { name: "Save this", exact: true }).click();
await page.locator(".notebook-button").click();
await page.waitForTimeout(350);
assert.equal(await page.locator(".notebook-item").count(), 1);
await page.getByRole("button", { name: /Replay source/ }).click();
await page.waitForTimeout(600);
assert.ok((await page.locator("video").evaluate((v) => v.currentTime)) >= 3);
console.log("save and source replay OK");
await page.keyboard.press("Escape");

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
assert.equal(overflow, 0);
assert.deepEqual(errors, []);
console.log("desktop console/overflow OK");

// Import a local video + SRT, then confirm IndexedDB restore after reload.
const importContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const importPage = await importContext.newPage();
const importErrors = [];
importPage.on("console", (msg) => { if (msg.type() === "error") importErrors.push(msg.text()); });
importPage.on("pageerror", (err) => importErrors.push(err.message));
await importPage.goto(BASE, { waitUntil: "networkidle" });
await importPage.getByRole("button", { name: /Import lesson/ }).click();
await importPage.locator('input[accept*="video"]').setInputFiles("public/demo/small-habits.mp4");
await importPage.locator('input[accept*=".srt"]').setInputFiles("public/demo/small-habits.srt");
await importPage.locator(".video-probe.is-ok").waitFor({ timeout: 15000 });
assert.match(await importPage.locator(".subtitle-preview").textContent(), /10 cues detected/);
await importPage.locator(".title-field input").fill("My Imported Habits Lesson");
await importPage.getByRole("button", { name: /Start learning/ }).click();
await importPage.waitForTimeout(1800);
assert.equal(await importPage.locator(".lesson-title-copy h1").textContent(), "My Imported Habits Lesson");
assert.match(await importPage.locator(".lesson-source").textContent(), /estimated word timing/);
await importPage.screenshot({ path: "screenshots/imported.png" });
await importPage.reload({ waitUntil: "networkidle" });
await importPage.waitForTimeout(1200);
assert.equal(await importPage.locator(".lesson-title-copy h1").textContent(), "My Imported Habits Lesson");
const src = await importPage.locator("video").getAttribute("src");
assert.ok(src.startsWith("blob:"));
assert.deepEqual(importErrors, []);
console.log("local import and reload restore OK");

// Mobile layout and bottom sheet.
const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobile = await mobileContext.newPage();
const mobileErrors = [];
mobile.on("console", (msg) => { if (msg.type() === "error") mobileErrors.push(msg.text()); });
mobile.on("pageerror", (err) => mobileErrors.push(err.message));
await mobile.goto(BASE, { waitUntil: "networkidle" });
await mobile.waitForTimeout(600);
assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
await mobile.locator(".word-token", { hasText: "progress" }).first().click();
await mobile.waitForTimeout(500);
assert.ok(await mobile.locator(".inspector-card.has-focus").isVisible());
await mobile.screenshot({ path: "screenshots/mobile-word.png" });
assert.deepEqual(mobileErrors, []);
console.log("mobile layout and inspector sheet OK");

await browser.close();
console.log("ALL E2E CHECKS PASSED");
