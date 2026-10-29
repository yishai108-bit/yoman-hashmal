// שמירת ברקודים בלי דריסה (גרסה 52 של יומן אתר)
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

const doc = (page, p) => page.evaluate(p => { const b = window.__MOCK_STORE__.get(p); return b ? JSON.parse(JSON.stringify(b)) : null; }, p);

test("ברקוד: שתי הצמדות ממכשירים שונים נשמרות שתיהן", async () => {
  const seed = { ...fixture, settings: { barcodes: { map: {}, ts: 1 } } };
  const { page, ctx } = await openApp(browser, { mock: { role: "owner", seed } });
  await page.evaluate(() => { window.__MOCK_STORE__.get("settings/barcodes").map["111"] = "289"; });   // מכשיר אחר
  await page.evaluate(() => saveBarcode("222", "307"));
  const s = await doc(page, "settings/barcodes");
  assert.deepStrictEqual(s.map, { "111": "289", "222": "307" });
  await ctx.close();
});
