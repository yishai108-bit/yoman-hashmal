// צילומי מסך של כל הלשוניות ושל חלון ההגדרות, ברוחב 400. שימוש: node tests/tools/screens.js <תיקיית-פלט> [קובץ]
const path = require("path");
const { launch, openApp } = require("../helpers");
const fixture = require("../fixture");
(async () => {
  const out = process.argv[2] || path.join(__dirname, "..", "out", "screens");
  const file = process.argv[3];
  require("fs").mkdirSync(out, { recursive: true });
  const browser = await launch();
  const { page, errors } = await openApp(browser, { mock: { seed: fixture }, ...(file ? { file } : {}) });
  for (const t of ["Over", "Stock", "Concrete", "Panels", "Day", "Orders"]) {
    await page.click("#tab" + t); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, t + ".png"), fullPage: true });
  }
  await page.click("#tabStock"); await page.click("#btnNote"); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, "sheet-note.png") });
  await page.keyboard.press("Escape");
  await page.click("#btnSettings"); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, "sheet-settings.png") });
  console.log(errors.length ? "errors: " + errors.join("\n") : "ok");
  await browser.close();
})();
