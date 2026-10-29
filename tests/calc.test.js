// חישובים: מלאי, מי מחזיק מה, בקשות רכש מול הזמנות ומה שהגיע.
// בדיקות אפיון: מקבעות את ההתנהגות של גרסה 52 כדי ששינוי עתידי (פיצול הקוד) לא ישבור אותה בשקט.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const byName = rows => Object.fromEntries(rows.map(r => [r.name, r]));

test("מלאי: נכנס מתעודות, יוצא בניפוק, החזרה מקטינה את היציאה, זיכוי מקטין את הכניסה", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: fixture } });
  const r = byName(await page.evaluate(() => stockRows()));
  assert.strictEqual(r["בורג M8"].in, 150);           // 100 + 50
  assert.strictEqual(r["בורג M8"].out, 25);           // 30 יצאו, 5 חזרו
  assert.strictEqual(r["בורג M8"].derived, 125);
  assert.strictEqual(r["כבל סולארי 6"].in, 480);      // 500 ועוד זיכוי של 20-
  assert.strictEqual(r["כבל סולארי 6"].counted, 470); // הספירה נשמרת לצד החישוב ולא דורסת אותו
  assert.strictEqual(r["כבל סולארי 6"].derived, 480);
  assert.strictEqual(r["מקדחה"].noIn, true);          // נופק בלי שהגיע בתעודה
  assert.strictEqual(r["מקדחה"].cat, "staging");
  await ctx.close();
});

test("מלאי: תעודה ב\"אלף\" או ב\"מאה\" נספרת ביחידות, וניפוק ביחידות יורד ממנה", async () => {
  const T = fixture.deliveries.n1.ts;
  const seed = { ...fixture,
    deliveries: { ...fixture.deliveries,
      n3: { supplier: "ספק ב", noteNo: "2001", ts: T + 1, source: "app", lines: [
        { name: "אום M8 נירוסטה", qty: 0.5, unit: "אלף", cat: "construction" },
        { name: "דיסקית M12", qty: 1.2, unit: "מאה", cat: "construction" } ] } },
    moves: { ...fixture.moves, m9: { item: "אום M8 נירוסטה", qty: 40, dir: "out", who: "צוות 1", ts: T + 2 } } };
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  const r = byName(await page.evaluate(() => stockRows()));
  assert.strictEqual(r["אום M8 נירוסטה"].in, 500);
  assert.strictEqual(r["אום M8 נירוסטה"].derived, 460);
  assert.strictEqual(r["אום M8 נירוסטה"].unit, "יח'");
  assert.strictEqual(r["דיסקית M12"].in, 120);
  await ctx.close();
});

test("מי מחזיק מה: נטו לכל אדם ופריט, בלי מי שהחזיר הכול", async () => {
  const seed = { ...fixture, moves: { ...fixture.moves,
    m4: { item: "מקדחה", qty: 2, dir: "in", who: "צוות 2", ts: fixture.moves.m3.ts + 1 } } };
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  const h = await page.evaluate(() => holders());
  assert.deepStrictEqual(h.map(x => [x.who, x.item, x.qty]), [["צוות 1", "בורג M8", 25]]);
  await ctx.close();
});

test("כתב כמויות: תוכנן מול הגיע, לפי קישור לסעיף או לפי שם, ויחידות «אלף» מוכפלות", async () => {
  const now = Date.now(), D = 864e5;
  const seed = {
    settings: { boq: { source: "בדיקה", lines: [
      { code: "1.1", name: "כבל סולארי 6 מ\"מ", qty: 1000, unit: "מ'" },
      { code: "1.2", name: "מחבר MC4 זוג", qty: 200, unit: "יח'" },
      { code: "1.3", name: "צינור קוברה 50", qty: 300, unit: "מ'" } ] } },
    deliveries: {
      n1: { supplier: "ספק א", noteNo: "1", ts: now - 2 * D, source: "app",
        lines: [ { name: "כבל PV 6 שחור", qty: 400, unit: "מ'", boq: "1.1" },
                 { name: "מחבר MC4 זוג", qty: 0.2, unit: "אלף" } ] },
    },
  };
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  const c = await page.evaluate(() => Object.fromEntries(catalog().filter(e => e.planned).map(e => [e.code, [e.planned, e.arrived, e.remaining]])));
  assert.deepStrictEqual(c, { "1.1": [1000, 400, 600], "1.2": [200, 200, 0], "1.3": [300, 0, 300] });
  await page.click("#tabBoq");
  assert.match(await page.textContent("#boqBig"), /^\d+%$/);
  assert.strictEqual(await page.locator("#boqList .boqrow").count(), 3);
  await ctx.close();
});
