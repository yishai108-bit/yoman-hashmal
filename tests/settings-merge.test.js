// שמירת ספקים/ברקודים בלי דריסה (גרסה 52)
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

async function makeOrder(page, supplier){
  await page.click("#tabOrders");
  await page.click("#btnOrder");
  await page.fill("#orTask", "בדיקה");
  await page.click('#orFilt [data-f="all"]');
  await page.click("#orSug .slip");
  await page.fill('#orLines input[aria-label="ספק"]', supplier);
  await page.dispatchEvent('#orLines input[aria-label="ספק"]', "change");
  await page.click("#orSave");
  await page.waitForTimeout(200);
}
const toastText = page => page.evaluate(() => { const t = document.querySelector(".toast"); return t && !t.hidden ? t.textContent : ""; });
const doc = (page, p) => page.evaluate(p => { const b = window.__MOCK_STORE__.get(p); return b ? JSON.parse(JSON.stringify(b)) : null; }, p);

test("עורך (לא בעלים) שומר בקשת רכש: נשמרת, בלי «השמירה נכשלה»", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { role: "editor", seed: fixture } });
  await makeOrder(page, "ספק ב");
  assert.doesNotMatch(await toastText(page), /נכשלה/);
  const orders = await page.evaluate(() => [...window.__MOCK_STORE__.keys()].filter(k => k.startsWith("orders/")));
  assert.strictEqual(orders.length, 1);
  assert.strictEqual(await doc(page, "settings/suppliers"), null, "עורך לא כותב להגדרות");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("בעלים: ספק חדש נוסף על גבי מה שיש במאגר, לא דורס", async () => {
  const seed = { ...fixture, settings: { suppliers: { map: { "פריט ישן": "ספק ישן" }, ts: 1 } } };
  const { page, ctx } = await openApp(browser, { mock: { role: "owner", seed } });
  // מכשיר אחר הוסיף ספק אחרי שהדף נטען, והעדכון עוד לא הגיע לזיכרון של הדף הזה
  await page.evaluate(() => { const m = window.__MOCK_STORE__.get("settings/suppliers"); m.map["פריט ממכשיר אחר"] = "ספק ג"; });
  await makeOrder(page, "ספק ב");
  const s = await doc(page, "settings/suppliers");
  assert.strictEqual(s.map["פריט ישן"], "ספק ישן");
  assert.strictEqual(s.map["פריט ממכשיר אחר"], "ספק ג");
  assert.strictEqual(s.map["בורג M8"] || s.map["כבל סולארי 6"], "ספק ב");
  await ctx.close();
});

test("ברקוד: שתי הצמדות ממכשירים שונים נשמרות שתיהן", async () => {
  const seed = { ...fixture, settings: { barcodes: { map: {}, ts: 1 } } };
  const { page, ctx } = await openApp(browser, { mock: { role: "owner", seed } });
  await page.evaluate(() => { window.__MOCK_STORE__.get("settings/barcodes").map["111"] = "289"; });   // מכשיר אחר
  await page.evaluate(() => saveBarcode("222", "307"));
  const s = await doc(page, "settings/barcodes");
  assert.deepStrictEqual(s.map, { "111": "289", "222": "307" });
  await ctx.close();
});
