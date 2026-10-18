import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3010";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
fs.mkdirSync("screenshots", { recursive: true });

await page.locator(".lesson-actions .button-coral").click();
await page.waitForTimeout(500);
assert.equal((await page.getByRole("tab", { name: /Lines/ }).getAttribute("aria-selected")), "true");
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Line 1 / 10");
assert.match(await page.locator(".practice-prompt h1").textContent(), /Type the line/);
console.log("sentence-first entry OK");

await page.getByRole("button", { name: /don’t know/i }).click();
await page.waitForTimeout(900);
assert.match(await page.locator(".feedback-heading strong").textContent(), /revealed/i);
assert.ok(await page.locator(".line-vocab").isVisible());
assert.ok((await page.locator(".vocab-chip").count()) >= 3);
const selectedWord = (await page.locator(".vocab-word-head h4").textContent()).trim();
assert.ok(["moment", "change", "lives", "wait"].includes(selectedWord), selectedWord);
assert.ok((await page.locator(".vocab-translation").textContent()).trim().length > 0);
assert.ok((await page.locator(".vocab-examples").count()) > 0);
assert.ok((await page.locator(".vocab-phrases").count()) > 0);
console.log("revealed answer + free dictionary card OK:", selectedWord);
await page.screenshot({ path: "screenshots/sentence-vocab.png" });

await page.getByRole("button", { name: /Save word/ }).click();
await page.getByRole("button", { name: /Save line/ }).click();
let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cadence:items:v1") || "[]"));
assert.equal(stored.length, 2);
const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem("cadence:attempts:v1") || "[]"));
assert.equal(attempts.length, 1);
assert.equal(attempts[0].correct, false);
assert.equal(attempts[0].score, 0);

await page.getByRole("button", { name: /Next line/ }).click();
await page.waitForTimeout(400);
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Line 2 / 10");
console.log("next line transition OK");
await page.locator(".practice-close").click();
await page.waitForTimeout(400);

await page.locator(".notebook-button").click();
await page.waitForTimeout(400);
assert.equal(await page.locator(".notebook-item").count(), 2);
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByLabel("New notebook text").fill("deliberate");
await page.getByLabel("New notebook meaning").fill("故意的；刻意的");
await page.getByRole("button", { name: /Add to notebook/ }).click();
await page.waitForTimeout(400);
assert.equal(await page.locator(".notebook-item").count(), 3);
assert.match(await page.locator(".notebook-list").textContent(), /deliberate/);
console.log("manual notebook add OK");
await page.screenshot({ path: "screenshots/notebook-add.png" });

const csvDownloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: /Export CSV/ }).click();
const csvDownload = await csvDownloadPromise;
const csvPath = await csvDownload.path();
const csv = fs.readFileSync(csvPath, "utf8");
assert.match(csv, /deliberate/);
assert.match(csv, /"type","text","translation"/);
console.log("CSV export OK", csvDownload.suggestedFilename());

const jsonDownloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: /Export JSON/ }).click();
const jsonDownload = await jsonDownloadPromise;
console.log("JSON export OK", jsonDownload.suggestedFilename());

const beforeDelete = await page.locator(".notebook-item").count();
await page.locator(".small-action-danger").first().click();
await page.waitForTimeout(300);
assert.equal(await page.locator(".notebook-item").count(), beforeDelete - 1);
console.log("notebook delete OK");
assert.deepEqual(errors, []);
console.log("ALL SENTENCE/NOTEBOOK CHECKS PASSED");
await browser.close();
