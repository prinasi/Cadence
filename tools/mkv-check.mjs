import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
fs.mkdirSync("screenshots", { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:3010", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Import lesson/ }).click();
await page.locator('input[accept*="video"]').setInputFiles(".tmp/small-habits.mkv");
await page.locator('input[accept*=".srt"]').setInputFiles("public/demo/small-habits.srt");
await page.waitForTimeout(1600);
console.log("probe:", (await page.locator(".video-probe").textContent()).trim());
await page.screenshot({ path: "screenshots/mkv-import.png" });
assert.match(await page.locator(".video-probe").textContent(), /MKV/);
const start = page.getByRole("button", { name: /Start learning/ });
assert.equal(await start.isEnabled(), true);
await page.locator(".title-field input").fill("MKV Habits Lesson");
await start.click();
await page.waitForTimeout(1800);
assert.equal(await page.locator(".lesson-title-copy h1").textContent(), "MKV Habits Lesson");
console.log("video:", await page.locator("video").evaluate((v) => ({ duration: v.duration, w: v.videoWidth, h: v.videoHeight, ready: v.readyState })));
await page.screenshot({ path: "screenshots/mkv-loaded.png" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
assert.equal(await page.locator(".lesson-title-copy h1").textContent(), "MKV Habits Lesson");
assert.match(await page.locator("video").getAttribute("src"), /^blob:/);
console.log("restored MKV:", await page.locator("video").evaluate((v) => ({ duration: v.duration, ready: v.readyState })));
assert.deepEqual(errors, []);
console.log("valid MKV import OK");

const bad = await context.newPage();
await bad.goto("http://127.0.0.1:3010", { waitUntil: "networkidle" });
await bad.getByRole("button", { name: /Import lesson/ }).click();
await bad.locator('input[accept*="video"]').setInputFiles(".tmp/unsupported.mkv");
await bad.locator('input[accept*=".srt"]').setInputFiles("public/demo/small-habits.srt");
await bad.waitForTimeout(13000);
console.log("unsupported probe:", (await bad.locator(".video-probe").textContent()).trim());
assert.match(await bad.locator(".video-probe").textContent(), /codec|decode|long/i);
assert.equal(await bad.getByRole("button", { name: /Start learning/ }).isEnabled(), false);
await bad.screenshot({ path: "screenshots/mkv-unsupported.png" });
console.log("unsupported MKV blocked OK");
console.log("errors", errors);
await browser.close();
