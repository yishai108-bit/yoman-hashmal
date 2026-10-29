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

test("בקשות מול הזמנות: לא הוזמן, חדש, ממתין, חסר, מוקפא, הגיע", async () => {
  const D = 864e5, now = Date.now();
  const ord = (id, ago, name, qty) => ({ no: "R-" + id, status: "sent", ts: now - ago * D, task: "בדיקה", by: "בודק",
    lines: [{ name, qty, unit: "יח'", cat: "electrical", supplier: "ספק" }] });
  const po = (no, ago, name, qty, status) => ({ no, status: status || "open", ts: now - ago * D,
    lines: [{ name, qty, unit: "יח'" }] });
  const seed = {
    orders: {
      o1: ord(1, 10, "כבל UV", 100), o2: ord(2, 1, "מהדק", 50), o3: ord(3, 10, "ממיר", 4),
      o4: ord(4, 10, "בורג X", 10), o5: ord(5, 10, "תיבת חיבורים", 20), o6: ord(6, 10, "RS485", 3),
    },
    pos: {
      p1: po("PO-1", 5, "ממיר", 4), p2: po("PO-2", 5, "בורג X", 6),
      p3: po("PO-3", 5, "תיבת חיבורים", 20), p4: po("PO-4", 5, "RS485", 3, "hold"),
    },
    deliveries: {
      n1: { supplier: "ספק", noteNo: "9", ts: now - 2 * D, source: "app",
        lines: [{ name: "תיבת חיבורים", qty: 20, unit: "יח'", cat: "electrical" }] },
    },
  };
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  const k = await page.evaluate(() => Object.fromEntries(requestMatch().rows.map(r => [r.l.name, [r.k, r.ordered, r.arrived]])));
  assert.deepStrictEqual(k, {
    "כבל UV": ["none", 0, 0], "מהדק": ["fresh", 0, 0], "ממיר": ["wait", 4, 0],
    "בורג X": ["short", 6, 0], "תיבת חיבורים": ["ok", 20, 20], "RS485": ["hold", 0, 0],
  });
  await ctx.close();
});
