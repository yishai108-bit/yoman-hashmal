// כל החלונות הקופצים נפתחים בלי שגיאות JS, מוצגים, ונסגרים בכפתור הסגירה.
// שומר על המעבר לפונקציה המשותפת popup() ועל כל שינוי עתידי במבנה.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

const OPENERS = [
  "openNote()", "openImport()", "openAllNotes()", "openNoteDetail(shared.deliveries[0].id)",
  "openMove('בורג M8')", "openMoveSlip('צוות 2','מקדחה')",
  "openIssue()", "openAllSlips([])", "openQuickCount()", "openWa()",
  "openFabMenu()", "openEquipIssue()", "openStockActions()",
  "openSettings()", "openRestore()", "openWorker()", "openCrewForm()",
  "openBoqLinker()", "openBoqImport()", "openWeekly()", 
  "openStatusImport()", "openDrumIntake()", "openCableTypes()", "openWho()", "openLog()", "alertSheet('כותרת','<p>טקסט</p>')",
  "openWorkReport()", "openBlocker()", "openActivityTemplate()",
];
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("כל החלונות הקופצים נפתחים ונסגרים", async () => {
  const seed = { ...fixture, settings: { boq: { source: "בדיקה", lines: [{ code: "1.1", name: "כבל סולארי 6", qty: 1000, unit: "מ'", supplier: "ספק א" }] } } };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed } });
  const failed = [];
  for (const call of OPENERS){
    await page.evaluate(() => document.querySelectorAll(".scrim").forEach(s => s.remove()));
    const n = errors.length;
    const r = await page.evaluate(c => { try { (0, eval)(c); return ""; } catch (e) { return String(e); } }, call);
    await page.waitForTimeout(80);
    const open = await page.evaluate(() => { const s = [...document.querySelectorAll(".scrim")].pop();
      return s ? { sheet: !!s.querySelector(".sheet"), shown: s.getBoundingClientRect().height > 0 } : null; });
    if (r || errors.length > n || !open || !open.sheet || !open.shown) { failed.push(call + " " + (r || errors.slice(n).join(" ") || JSON.stringify(open))); continue; }
    const btn = await page.$(".scrim:last-of-type .cancel");
    if (btn){ await btn.click(); await page.waitForTimeout(50); }
  }
  assert.deepStrictEqual(failed, []);
  await ctx.close();
});

test("Escape סוגר רק את החלון העליון, ולחיצה על הרקע סוגרת", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  const count = () => page.evaluate(() => document.querySelectorAll(".scrim").length);
  await page.evaluate(() => { openNoteDetail(shared.deliveries[0].id); openLog(); });
  assert.strictEqual(await count(), 2);
  await page.keyboard.press("Escape");
  assert.strictEqual(await count(), 1);
  await page.keyboard.press("Escape");
  assert.strictEqual(await count(), 0);
  await page.evaluate(() => openSlip({ id: "x", ts: Date.now(), who: "קבלן", lines: [] }));
  await page.mouse.click(5, 5);                      // הרקע, מחוץ לגיליון
  assert.strictEqual(await count(), 0);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
