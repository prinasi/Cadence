import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors=[]; page.on('console',m=>{if(m.type()==='error') errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message));
await page.goto("http://127.0.0.1:3010", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
const demo = JSON.parse(fs.readFileSync("content/demo-lesson.json", "utf8"));
await page.locator(".lesson-actions .button-coral").click();
await page.waitForTimeout(300);

assert.ok(await page.getByLabel("Start from line").isVisible());
await page.getByLabel("Start from line").selectOption("4");
await page.waitForTimeout(300);
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Line 5 / 10");
assert.match(await page.locator(".practice-eyebrow").textContent(), /Line 05/);
fs.mkdirSync("screenshots", { recursive: true });
await page.screenshot({ path: "screenshots/start-line.png" });

// Skip lines 5 and 6, attempt 7, then skip the rest.
await page.getByRole("button", { name: "Skip", exact: true }).click();
await page.waitForTimeout(150);
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Line 6 / 10");
await page.getByRole("button", { name: "Skip", exact: true }).click();
await page.waitForTimeout(150);
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Line 7 / 10");
assert.equal((await page.locator(".correct-sentence-block").count()), 0);

await page.getByRole("button", { name: /don’t know/i }).click();
await page.waitForTimeout(200);
assert.equal((await page.locator(".correct-sentence-block p").textContent()).trim(), demo.sentences[6].text);
await page.getByRole("button", { name: /Next line/ }).click();
await page.waitForTimeout(150);
for (const line of ["Line 8 / 10", "Line 9 / 10", "Line 10 / 10"]) {
  assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), line);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.waitForTimeout(120);
}
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Round complete");
assert.equal(await page.locator(".summary-row").count(), 6);
assert.equal(await page.locator(".summary-row.is-skipped").count(), 5);
assert.match(await page.locator(".summary-sub").textContent(), /0 of 1 attempted lines reconstructed exactly\. 5 skipped/);
const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem("cadence:attempts:v1") || "[]"));
assert.equal(attempts.length, 1);
await page.screenshot({ path: "screenshots/skip-summary.png" });
console.log("START LINE + SKIP + SKIPPED SUMMARY PASSED");

await page.getByRole("button", { name: /Back to the lesson/ }).click();
await page.waitForTimeout(250);
await page.locator(".transcript-line").nth(2).locator(".line-time").click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Start here/ }).click();
await page.waitForTimeout(300);
assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), "Line 3 / 10");
console.log("START HERE FROM TRANSCRIPT PASSED", errors);
assert.deepEqual(errors, []);
await browser.close();
