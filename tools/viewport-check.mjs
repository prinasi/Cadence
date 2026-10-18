import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const [w, h, label] of [[900, 1000, "tablet"], [390, 844, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors=[]; page.on('console',m=>{if(m.type()==='error') errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:3010", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".word-token", { hasText: "progress" }).first().click();
  await page.waitForTimeout(500);
  const box = await page.locator(".inspector-card.has-focus").boundingBox();
  console.log(label, "inspector box", box, "viewport", w, h, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= w + 1);
  await page.screenshot({ path: `screenshots/${label}-inspector.png` });
  await page.locator(".inspector-card .icon-close").click();
  await page.locator(".lesson-actions .button-coral").click();
  await page.waitForTimeout(400);
  const practiceOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(label, "practice overflow", practiceOverflow, "errors", errors);
  await page.screenshot({ path: `screenshots/${label}-practice.png` });
  assert.equal(practiceOverflow, 0);
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
