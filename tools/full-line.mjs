import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://127.0.0.1:3010", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.locator(".lesson-actions .button-coral").click();
await page.waitForTimeout(300);
for (let i = 1; i <= 10; i += 1) {
  assert.equal((await page.locator(".practice-progress-label").textContent()).trim(), `Line ${i} / 10`);
  await page.getByRole("button", { name: /don’t know/i }).click();
  await page.waitForTimeout(120);
  const label = i === 10 ? /See summary/ : /Next line/;
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(120);
}
assert.equal((await page.locator(".summary-kicker").textContent()).trim(), "Round complete");
assert.equal(await page.locator(".summary-row").count(), 10);
assert.match(await page.locator(".summary-sub").textContent(), /0 of 10 attempted lines/);
fs.mkdirSync("screenshots", { recursive: true });
await page.screenshot({ path: "screenshots/full-line-summary.png" });
console.log("FULL 10-LINE ROUND PASSED", errors);
await browser.close();
