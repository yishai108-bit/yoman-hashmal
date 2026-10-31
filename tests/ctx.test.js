// גרסה 23: סעיפי «מצב השטח» (ctx:true), למשל קונסטרוקציה ופאנלים של הקבלן הראשי שיובאו מיומן אתר:
// נצבעים במפה ומוצגים בקבוצה נפרדת בסוף הסטטוס, לא נספרים מול ההסכם / בחשבון / בדוח השבועי / בסיכום היומי, לא נבחרים לדיווח חדש;
// סעיפים במאגר מוציאים כל מכשיר מתצוגת הדוגמה. נתונים סינתטיים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const T = isoOf(new Date());
const CTXG = "מצב השטח · קבלן ראשי (לא בהסכם)";
const status = {
  s1: { id: "s1", code: "2.1", name: "הארקה 25 משולחנות עד תחנת ממירים", unit: "מ׳", group: "ב · שדה", order: 1, total: 2500, manDays: 48,
        daily: [{ id: "d1", date: T, actual: 100, area: "צפון מערב", crew: "צוות א", workers: 3, ts: 1 }] },
  c1: { id: "c1", code: "", name: "קונסטרוקציית שולחנות (קבלן ראשי)", unit: "שולחנות", group: CTXG, order: 9001, total: 258, ctx: true,
        daily: [{ id: "p1", date: T, actual: 36, area: "צפון מערב", rows: [1, 6], crew: "קבלן ראשי", workers: 0, by: "ייבוא", ts: 1 }] },
  c2: { id: "c2", code: "", name: "הרכבת פאנלים (קבלן ראשי)", unit: "שולחנות", group: CTXG, order: 9002, total: 258, ctx: true,
        daily: [{ id: "p2", date: T, actual: 28, area: "צפון מערב", rows: [1, 5], crew: "קבלן ראשי", workers: 0, by: "ייבוא", ts: 1 }] },
};
const layout = { gen: { fields: 2, rows: 6, mvs: 1, skids: 2, bess: 0, room: 0, names: "צפון מערב, צפון מזרח" }, map: {}, ts: 1 };
const closeAll = () => document.querySelectorAll(".scrim").forEach(x => x.remove());

test("ctx: לא בחשבון, לא בדוח השבועי, לא בסיכום היומי, לא בבחירת סעיף; כן במפה (שלב קונסטרוקציה) ובקבוצה נפרדת", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status, settings: { layout } } } });
  await page.waitForFunction(() => shared.STATUS.length === 3);
  const r = await page.evaluate(T => {
    const B = billData(T, T, {}), W = wrData(T), M = siteStagesModel();
    const con = PHASES.find(p => p.k === "con"), pan = PHASES.find(p => p.k === "panels");
    const f1 = M.L.fields[0].id, s = M.state(1);
    const kill = () => document.querySelectorAll(".scrim").forEach(x => x.remove());
    kill(); openWorkReport({});
    const optsNew = [...document.querySelectorAll("#prAct option")].map(o => o.value);
    kill(); openWorkReport({ activityId: "c1", entry: shared.STATUS.find(a => a.id === "c1").daily[0] });
    const optsEdit = [...document.querySelectorAll("#prAct option")].map(o => o.value);
    kill();
    return JSON.parse(JSON.stringify({
      bill: B.acts.map(a => a.id), wr: W.acts.map(a => a.id), workN: W.workN, rows: workRows(T).map(x => x.activity.id),
      out: workOutput("קבלן ראשי", T, T, []).length, crews: workCrews(), sum: dailySummaryText(T),
      list: [...document.querySelectorAll("#statusList .slip.st")].map(b => b.classList.contains("ctx")),
      head: (document.querySelector("#statusList .grouphead.ctx") || {}).textContent || "", fold: document.querySelector("#sum_status").textContent,
      conActs: phaseActs(con, shared.STATUS.concat([{ id: "x", name: "הארקה 16 בין חלקי הקונסטרוקציה", daily: [] }]), null).map(a => a.id),
      panActs: phaseActs(pan, shared.STATUS, null).map(a => a.id),
      conRep: M.P.find(p => p.k === "con").rep, panRep: M.P.find(p => p.k === "panels").rep, unplaced: M.unplaced().length,
      conRows: (s.R[f1] || {}).con, panRows: (s.R[f1] || {}).panels, legend: [...document.querySelectorAll("#stagesCard .ss-ph")].map(e => e.id),
      optsNew, optsEdit,
    }));
  }, T);
  assert.deepStrictEqual(r.bill, ["s1"]); assert.deepStrictEqual(r.wr, ["s1"]); assert.strictEqual(r.workN, 1);
  assert.deepStrictEqual(r.rows, ["s1"]); assert.strictEqual(r.out, 0); assert.ok(!r.crews.includes("קבלן ראשי"), "crew of ctx not suggested");
  assert.ok(r.sum.includes("הארקה 25") && !r.sum.includes("קבלן ראשי"), r.sum);
  assert.deepStrictEqual(r.list, [false, true, true]); assert.ok(r.head.includes("מצב השטח (לא בהסכם)"), r.head); assert.strictEqual(r.fold, "1 פעילויות");
  assert.deepStrictEqual(r.conActs, ["c1"]); assert.deepStrictEqual(r.panActs, ["c2"]);
  assert.strictEqual(r.conRep, 36); assert.strictEqual(r.panRep, 28); assert.strictEqual(r.unplaced, 0);
  assert.deepStrictEqual(r.conRows.map(v => v > 0), [true, true, true, true, true, true]);
  assert.deepStrictEqual(r.panRows.map(v => v > 0), [true, true, true, true, true, false]);
  assert.ok(r.legend.includes("ss_con"), r.legend.join(","));
  assert.ok(!r.optsNew.includes("c1") && !r.optsNew.includes("c2") && r.optsNew.includes("s1"), optsNew(r));
  assert.ok(r.optsEdit.includes("c1"), r.optsEdit.join(","));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
  function optsNew(r){ return r.optsNew.join(","); }
});

test("ctx/דוגמה: סעיפים במאגר בלי משלוחים מוציאים מתצוגת הדוגמה, והמפה לא ריקה", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { status: { c1: status.c1 }, settings: { layout } } } });
  await page.waitForFunction(() => shared.STATUS.length === 1 && shared.demoStock === false);
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({ bar: document.querySelector("#demoBarS").hidden, bare: document.querySelector("#stagesCard").classList.contains("ss-bare"),
    ctxRows: document.querySelectorAll("#statusList .slip.st.ctx").length, fold: document.querySelector("#sum_status").textContent }));
  assert.strictEqual(r.bar, true); assert.strictEqual(r.bare, false); assert.strictEqual(r.ctxRows, 1); assert.strictEqual(r.fold, "1 סעיפי מצב השטח");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
