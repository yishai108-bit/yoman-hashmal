// «מפת האתר» (עד גרסה 20 «האתר לפי שלבים»): האיור ניזון מדיווחי הביצוע, אזור בדיווח צובע את היעד שלו, ושלב מאוחר מושך בציור את הקודמים.
// מגרסה 21 זו המפה היחידה: כרטיס «האתר נבנה» ירד, השולחנות האמיתיים (src/maps) מצוירים בתוך השדות, לחיצה אחת פנימה ואחת החוצה.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { launch, openApp, ROOT } = require("./helpers");
const fixture = require("./fixture");

// סטטוס סינתטי: סעיף לכל שלב באיור (בלי נתוני חברה)
const D = (date, actual, area) => ({ id: "d" + date + actual, date, actual, ...(area ? { area } : {}) });
const status = {
  a1: { id: "a1", order: 1, name: "חפירת תעלות", unit: "מ׳", total: 2000, daily: [D("2026-09-01", 400), D("2026-09-08", 400)] },
  a2: { id: "a2", order: 2, name: "כבלי AL בתעלות", unit: "מ׳", total: 2000, daily: [D("2026-09-10", 500)] },
  a3: { id: "a3", order: 3, name: "כיסוי תעלות", unit: "מ׳", total: 2000, daily: [D("2026-09-15", 300)] },
  a4: { id: "a4", order: 4, name: "מצעים למשטחים", unit: "קומפ׳", total: 4, daily: [D("2026-09-05", 2)] },
  a5: { id: "a5", order: 5, name: "בטון משטחים", unit: "קומפ׳", total: 4, daily: [D("2026-09-12", 1)] },
  a6: { id: "a6", order: 6, name: "מכולות אגירה", unit: "יח׳", total: 6, daily: [D("2026-09-20", 2, "אגירה")] },
  a7: { id: "a7", order: 7, name: "עמודים", unit: "יח׳", total: 4000, daily: [D("2026-09-02", 1000), D("2026-09-09", 1000)] },
  a8: { id: "a8", order: 8, name: "התקנת פאנלים", unit: "יח׳", total: 8000, daily: [D("2026-09-16", 2000, "שדה C")] },
  a9: { id: "a9", order: 9, name: "שרשור פאנלים", unit: "קומפ׳", total: 4, daily: [D("2026-09-25", 1)] },
};

// שתי הבדיקות הראשונות באתר בלי מפת שולחנות, כדי לקבל את הסכמה מהמספרים (באתר עם מפה המבנה נלמד מהמפה)
const NOMAP = { settings: { site: { name: "אתר בדיקה", company: "S.E.E", ts: 1 } } };
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("האיור מופיע מהסטטוס, הכמויות אמיתיות, בלי גלילה אופקית ב-400", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status, ...NOMAP } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => {
    const v = k => (document.querySelector("#ss_" + k + " .v") || {}).textContent;
    return { body: document.querySelector("#ssBody").hidden, empty: document.querySelector("#ssEmpty").hidden, cv: document.querySelector("#ssCv").width,
      dig: v("dig"), cable: v("cable"), cover: v("cover"), bess: v("bess"), panels: v("panels"), strings: v("strings"), skid: v("skid"),
      sum: (document.querySelector("#sum_stages") || {}).textContent };
  });
  assert.strictEqual(r.body, false); assert.strictEqual(r.empty, true); assert.ok(r.cv > 0, "הקנבס לא צויר");
  assert.deepStrictEqual([r.dig, r.cable, r.cover, r.bess, r.panels, r.strings, r.skid], ["800", "500", "300", "2", "2,000", "1", "—"]);
  assert.match(r.sum, /שלבים/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  await ctx.close();
});

test("אזור בדיווח צובע את היעד שלו; שלב מאוחר מושך את הקודמים; בתחילת הציר הכל ריק", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status, ...NOMAP } } });
  const r = await page.evaluate(() => {
    const s = siteStagesState(1), z = siteStagesState(0);
    let bad = 0;
    const chains = { trench: ["dig", "cable", "cover"], pad: ["base", "conc"], pv: ["piles", "panels", "strings"] };
    for (let k = 0; k <= 50; k++){ const st = siteStagesState(k / 50);
      for (const id in st.F){ const f = st.F[id]; const ch = id.startsWith("t") ? chains.trench : id.startsWith("f") ? chains.pv : chains.pad;
        for (let j = 1; j < ch.length; j++) if ((f[ch[j]] || 0) > (f[ch[j - 1]] || 0) + 1e-6) bad++; } }
    const zero = Object.values(z.F).every(f => Object.values(f).every(x => x === 0));
    return { bad, zero, fC: s.F.f3.panels, fB: s.F.f2.panels, fA: s.F.f1.panels, bess: s.F.bess.bess, bessConc: s.F.bess.conc, f3piles: s.F.f3.piles,
      unplaced: s.U, unList: siteStagesModel().unplaced().map(e => e.d), unNote: document.querySelector("#ssUnp").hidden, strings: s.V.strings };
  });
  assert.strictEqual(r.bad, 0);
  assert.strictEqual(r.zero, true);
  assert.strictEqual(r.fC, 1);            // 2,000 פאנלים ב«שדה C» = הקיבולת של שדה C (8,000 / 4 שדות)
  assert.strictEqual(r.fB, 0);            // ולא בשדה B
  assert.strictEqual(r.fA, 0);            // השרשור בלי אזור לא מנוחש לשדה A: נספר, לא נצבע
  assert.deepStrictEqual(r.unplaced.strings, { n: 1, q: 1 }); assert.strictEqual(r.strings, 1);   // הכמות נשארת אמיתית
  assert.strictEqual(r.unList.length, 9); assert.ok(r.unList.includes("d2026-09-251")); assert.strictEqual(r.unNote, false);   // 9 דיווחים בלי אזור ב«דיווחים בלי מיקום»
  assert.ok(Math.abs(r.bess - 2 / 6) < 1e-6, "מכולות: " + r.bess);
  assert.ok(r.bessConc >= r.bess);        // מכולה על משטח = יש בטון בציור
  assert.strictEqual(r.f3piles, 1);       // פאנלים בשדה C מושכים את העמודים שלו
  await ctx.close();
});

test("מבנה האתר מההגדרות: מספר השדות והשמות, שלב «לא במעקב»", async () => {
  const layout = { gen: { fields: 2, rows: 6, mvs: 1, skids: 2, bess: 0, room: 0, names: "B1, B2" }, map: { strings: "none" }, ts: 1 };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status, settings: { layout } } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const s = siteStagesState(1); return { ids: Object.keys(s.F), strings: !!document.querySelector("#ss_strings.off"), bess: !!document.querySelector("#ss_bess"), note: document.querySelector("#ssNote").textContent }; });
  assert.ok(r.ids.includes("f1") && r.ids.includes("f2") && !r.ids.includes("f3"));
  assert.ok(r.ids.includes("mvs1") && r.ids.includes("skid2") && !r.ids.includes("bess"));
  assert.strictEqual(r.strings, true);   // «לא במעקב»
  assert.strictEqual(r.bess, false);     // אין מכולות אגירה באתר: השלב לא מוצג
  assert.match(r.note, /2 שדות, 1 MVS, 2 סקידים/);
  await ctx.close();
});

test("בלי סטטוס: האיור מראה את האתר לפני העבודה, בלי מספרים וציר; מפה אחת בלבד («מפת האתר»), בלי כרטיס «האתר נבנה»", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, ...NOMAP } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ empty: document.querySelector("#ssEmpty").hidden, body: document.querySelector("#ssBody").hidden, bare: document.querySelector("#stagesCard").classList.contains("ss-bare"),
    cv: document.querySelector("#ssCv").width, range: getComputedStyle(document.querySelector("#ssRange")).display, title: document.querySelector("#stagesCard h3").childNodes[0].textContent, build: !!document.querySelector("#buildCard"), sb: !!document.querySelector("#sbBody") }));
  assert.deepStrictEqual(r, { empty: false, body: false, bare: true, cv: r.cv, range: "none", title: "מפת האתר", build: false, sb: false });
  assert.ok(r.cv > 0, "הקנבס לא צויר");
  await ctx.close();
  // אתר עם מפת שולחנות: אותו כרטיס אחד, והשולחנות האמיתיים בתוך השדות (עין תמר: 258 שולחנות ממפת הקונסטרוקציה)
  const o2 = await openApp(browser, { mock: { seed: fixture } });
  const r2 = await o2.page.evaluate(() => { const L = currentLayout(); return { title: document.querySelector("#stagesCard h3").childNodes[0].textContent, build: !!document.querySelector("#buildCard"), n: L.tables && L.tables.n, rows: L.fields.map(f => f.rowsT ? f.rowsT.length === f.rows : false), road: !!(L.tables && L.tables.road) }; });
  assert.deepStrictEqual(r2, { title: "מפת האתר", build: false, n: 258, rows: r2.rows, road: true }); assert.ok(r2.rows.length === 4 && r2.rows.every(Boolean), "שורות השדות = שורות השולחנות: " + r2.rows);
  await o2.ctx.close();
});

test("מבנה מתוכנית (JSON): שדות, משטחים ותעלות במיקומם, אזור בדיווח צובע את השדה הנכון", async () => {
  const plan = { fence: [0, 0, 1000, 700], fields: [{ name: "B1", x: 50, y: 300, w: 400, h: 350, rows: 12 }, { name: "B2", x: 550, y: 300, w: 400, h: 350, rows: 12 }],
    pads: [{ kind: "bess", name: "אגירה", x: 600, y: 50, w: 350, h: 120, units: 8 }, { kind: "mvs", name: "MVS 1", x: 100, y: 60, w: 80, h: 70 }],
    trenches: [{ name: "תעלה ראשית", pts: [[50, 250], [950, 250]] }, { name: "תעלה B2", pts: [[750, 250], [750, 320]] }] };
  const st = { p1: { id: "p1", order: 1, name: "התקנת פאנלים", unit: "יח׳", total: 1000, daily: [{ id: "x1", date: "2026-09-01", actual: 500, area: "B2" }] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { ...NOMAP.settings, layout: { layout: plan, gen: {}, map: {}, ts: 1 } } } } });   // תוכנית סינתטית: אתר בלי מפת שולחנות, אחרת השולחנות האמיתיים נכנסים לבד (גרסה 22)
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const s = siteStagesState(1); const L = currentLayout(); return { ids: Object.keys(s.F), b2: s.F.f2.panels, b1: s.F.f1.panels, fromPlan: L.fromPlan, names: L.fields.map(f => f.name), note: document.querySelector("#ssNote").textContent, bad: normLayout({ fields: [] }) }; });
  assert.deepStrictEqual(r.ids, ["t0", "t1", "bess1", "mvs1", "f1", "f2"]);
  assert.strictEqual(r.b2, 1); assert.strictEqual(r.b1, 0);   // 500 מתוך 1,000 = כל הקיבולת של B2
  assert.strictEqual(r.fromPlan, true); assert.deepStrictEqual(r.names, ["B1", "B2"]);
  assert.match(r.note, /לפי תוכנית האתר/); assert.strictEqual(r.bad, null);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  await ctx.close();
});

test("אתר עם מפת שולחנות ובלי הגדרת מבנה: רבעים מהמפה; אתר בלי מפה: סכמה מהמספרים", async () => {
  const st = { p1: { id: "p1", order: 1, name: "התקנת פאנלים", unit: "יח׳", total: 4000, daily: [{ id: "x1", date: "2026-09-01", actual: 1000, area: "צפון מזרח" }] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const L = currentLayout(), s = siteStagesState(1); return { fromTables: L.fromTables, names: L.fields.map(f => f.name), ne: s.F.f2.panels, nw: s.F.f1.panels, rows: L.fields.map(f => f.rows) }; });
  assert.strictEqual(r.fromTables, true);
  assert.deepStrictEqual(r.names, ["צפון מערב", "צפון מזרח", "דרום מערב", "דרום מזרח"]);
  assert.ok(r.rows.every(x => x >= 8 && x <= 14), "שורות לרבע: " + r.rows);
  assert.ok(r.ne > 0.9 && r.nw === 0, "צפון מזרח " + r.ne + " · צפון מערב " + r.nw);   // 1,000 מתוך 4,000 ≈ רבע אחד
  await ctx.close();
  const site = { name: "אתר בלי מפה", company: "S.E.E", ts: 1 };
  const o2 = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { site } } } });
  const r2 = await o2.page.evaluate(() => { const L = currentLayout(); return { fromTables: !!L.fromTables, n: L.fields.length }; });
  assert.deepStrictEqual(r2, { fromTables: false, n: 4 });
  await o2.ctx.close();
  // גרסה 22: מבנה מהתוכנית באתר עם מפה: השולחנות נכנסים לשדות לבד (התאמה אוטומטית, הדגל הישן tables מתעלמים ממנו); שורות השדה = שורות השולחנות במפה, וגבול השדה = גבול השולחנות שלו
  const plan = { fence: [0, 0, 1000, 700], fields: [{ name: "מערב", x: 50, y: 100, w: 440, h: 550, rows: 10 }, { name: "מזרח", x: 510, y: 100, w: 440, h: 550, rows: 10 }], pads: [], trenches: [] };
  for (const tables of [false, true]){
    const o3 = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { layout: { layout: plan, gen: {}, map: {}, ts: 1, ...(tables ? { tables: true } : {}) } } } } });
    const r3 = await o3.page.evaluate(() => { const L = currentLayout(); return { rows: L.fields.map(f => f.rows), real: L.fields.map(f => !!f.rowsT), n: L.tables ? L.tables.n : 0, plan: L.fields.every(f => f.plan && f.plan.w > 0), chk: !!document.querySelector("#lyTables") }; });
    assert.deepStrictEqual(r3.real, [true, true]); assert.strictEqual(r3.n, 258, "כל השולחנות במקומם, אף אחד לא אבד"); assert.ok(r3.rows.every(x => x >= 15 && x <= 40), "שורות " + r3.rows); assert.strictEqual(r3.plan, true);
    await o3.page.evaluate(() => openLayout()); assert.strictEqual(await o3.page.locator("#lyTables").count(), 0, "אין יותר תיבת סימון לשולחנות");
    await o3.ctx.close();
  }
  // המפה האמיתית של עין תמר מול מבנה מהתוכנית (4 רבעים): ההתאמה האוטומטית מכניסה את כל 258 השולחנות, כל רבע עם 10–12 שורות, והמלבן של כל שדה מכסה את השולחנות שלו
  const et = { fence: [151, 235, 629, 556], fields: [{ name: "צפון מערב", x: 196, y: 281, w: 227, h: 196, rows: 11 }, { name: "צפון מזרח", x: 435, y: 285, w: 282, h: 196, rows: 11 }, { name: "דרום מערב", x: 166, y: 477, w: 254, h: 203, rows: 12 }, { name: "דרום מזרח", x: 428, y: 481, w: 236, h: 206, rows: 12 }],
    pads: [{ kind: "bess", name: "אגירה", x: 481, y: 709, w: 75, h: 35, units: 10 }, { kind: "room", name: "חדר חשמל", x: 559, y: 705, w: 25, h: 39 }], trenches: [{ name: "תעלה מרכזית", pts: [[428, 281], [403, 684], [483, 712]] }] };
  const o4 = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { layout: { layout: et, gen: {}, map: {}, ts: 1 } } } } });
  const r4 = await o4.page.evaluate(() => { const L = currentLayout(); return { n: L.tables.n, fit: L.tables.fit, rows: L.fields.map(f => f.rows), cover: L.fields.every(f => f.rowsT.every(row => row.every(r => r.x >= f.x - .01 && r.x + r.w <= f.x + f.w + .01 && r.y >= f.y - .01 && r.y + r.h <= f.y + f.h + .01))) }; });
  assert.strictEqual(r4.n, 258); assert.ok(r4.fit >= 200, "התאמה: " + r4.fit + " בתוך המלבנים של התוכנית"); assert.ok(r4.rows.every(x => x >= 10 && x <= 12), "שורות לרבע " + r4.rows); assert.strictEqual(r4.cover, true);
  await o4.ctx.close();
});

test("טלפון: הכרטיס נבנה כשהוא מוסתר (לשונית אחרת / מקופל) והמפה עדיין נמדדת ומצוירת בשלמותה כשהוא נפתח", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture } } });
  for (const how of ["tab", "fold"]){
    await page.evaluate(h => { localStorage.setItem("tab", h === "tab" ? "day" : "over"); localStorage.setItem("folds", JSON.stringify(h === "fold" ? { stages: true } : {})); }, how);
    await page.reload(); await page.waitForFunction(() => document.querySelector("#ssCv"), null, { timeout: 8000 }); await page.waitForTimeout(500);
    const before = await page.evaluate(() => { const cv = document.querySelector("#ssCv"); return { w: cv.width, h: cv.height, css: cv.getBoundingClientRect().width }; });
    assert.strictEqual(before.css, 0, how + ": הקנבס מוסתר בהתחלה");
    if (how === "tab") await page.click("#tabOver"); else await page.click("#stagesCard h3");
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => { const cv = document.querySelector("#ssCv"), r = cv.getBoundingClientRect(), L = currentLayout(); return { w: cv.width, h: cv.height, css: r.width, ratio: r.height / r.width, want: L.h / L.w }; });
    assert.ok(after.css > 300 && after.w === Math.round(after.css), how + ": הקנבס נמדד מחדש כשהתגלה: " + JSON.stringify(after));
    assert.ok(Math.abs(after.ratio - after.want) < .02, how + ": יחס גובה-רוחב של המפה המלאה, לא 300×150: " + JSON.stringify(after));
  }
  await page.evaluate(() => { localStorage.removeItem("tab"); localStorage.removeItem("folds"); });
  await ctx.close();
});

test("מפה אמיתית: שורות בדיווח צובעות בדיוק אותן, לחיצה על המפה מזהה תעלה / משטח / שדה / שורה, ורק דיווח ממוקם נצבע", async () => {
  const plan = { fence: [0, 0, 1000, 700], fields: [{ name: "B1", x: 50, y: 300, w: 400, h: 350, rows: 10 }, { name: "B2", x: 550, y: 300, w: 400, h: 350, rows: 10 }],
    pads: [{ kind: "bess", name: "אגירה", x: 600, y: 50, w: 350, h: 120, units: 8 }, { kind: "mvs", name: "MVS 1", x: 100, y: 60, w: 80, h: 70 }],
    trenches: [{ name: "תעלה ראשית", pts: [[50, 250], [950, 250]] }] };
  // 1,000 פאנלים על 2 שדות = 500 לשדה = 50 לשורה. דיווח של 100 ב«B2 שורות 3–4» (טקסט), דיווח של 50 עם rows:[7,7] (מהמפה), ודיווח בלי אזור
  const st = { p1: { id: "p1", order: 1, name: "התקנת פאנלים", unit: "יח׳", total: 1000, daily: [
    { id: "x1", date: "2026-09-01", actual: 100, area: "B2 שורות 3–4" }, { id: "x2", date: "2026-09-02", actual: 50, area: "B2", rows: [7, 7] }, { id: "x3", date: "2026-09-03", actual: 50 } ] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { ...NOMAP.settings, layout: { layout: plan, gen: {}, map: {}, ts: 1 } } } } });   // תוכנית סינתטית: אתר בלי מפת שולחנות, אחרת השולחנות האמיתיים נכנסים לבד (גרסה 22)
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const s = siteStagesState(1), L = currentLayout(); const pk = (x, y) => { const t = pickAt(L, x, y); return t ? t.name : null; };
    const c = b => [b.x + b.w / 2, b.y + b.h / 2], tp = L.trenches[0].pts, f2 = L.fields[1], top = Math.min(22, f2.h * .18), sp = (f2.h - top - 4) / f2.rows;   // המבנה נמתח לרוחב 620, לכן הנקודות מהמבנה עצמו
    return { rows: s.R.f2.panels.map(v => Math.round(v * 100) / 100), b2: Math.round(s.F.f2.panels * 100) / 100, b1: s.F.f1.panels, un: s.U.panels,
      picks: [pk((tp[0][0] + tp[1][0]) / 2, tp[0][1] + 3), pk(...c(L.pads[0])), pk(...c(L.fields[0])), pk(...c(L.fields[1])), pk(2, 2)], row: rowAt(L, f2, f2.y + top + sp * 2.5), rows2: rowsOf({ area: "שדה E שורה 10" }) }; });
  assert.deepStrictEqual(r.rows, [0, 0, 1, 1, 0, 0, 1, 0, 0, 0]);   // שורות 3, 4 ו-7 מלאות, השאר ריקות
  assert.strictEqual(r.b2, 0.3); assert.strictEqual(r.b1, 0);        // 150 מתוך 500 בשדה B2, כלום ב-B1
  assert.deepStrictEqual(r.un, { n: 1, q: 50 });                     // הדיווח בלי אזור: נספר, לא נצבע
  assert.deepStrictEqual(r.picks, ["תעלה ראשית", "אגירה", "B1", "B2", null]);
  assert.strictEqual(r.row, 3); assert.deepStrictEqual(r.rows2, [10, 10]);
  await ctx.close();
});

test("מזהה אזור קבוע: דיווח עם areaId נשאר מחובר אחרי שינוי שם; דיווח ישן לפי שם; areaId שלא במבנה נופל לשם; ensureIds שומר מזהים", async () => {
  // המבנה נשמר עם מזהים; השדה הראשון שונה שמו מאז הדיווח («שדה ישן» → «חלקה 1»), השני נשאר «חלקה 6»
  const plan = { fence: [0, 0, 1000, 700], fields: [{ id: "fx1", name: "חלקה 1", x: 50, y: 300, w: 400, h: 350, rows: 10 }, { id: "fx2", name: "חלקה 6", x: 550, y: 300, w: 400, h: 350, rows: 10 }],
    pads: [{ id: "m1", kind: "mvs", name: "MVS 1", x: 100, y: 60, w: 80, h: 70 }], trenches: [{ id: "tr-main", name: "תעלה ראשית", pts: [[50, 250], [950, 250]] }] };
  const st = { p1: { id: "p1", order: 1, name: "התקנת פאנלים", unit: "יח׳", total: 1000, daily: [
    { id: "a", date: "2026-09-01", actual: 100, area: "שדה ישן", areaId: "fx1" },     // שם ישן, מזהה תקף: מחובר לחלקה 1
    { id: "b", date: "2026-09-02", actual: 100, area: "חלקה 6" },                     // דיווח ישן בלי מזהה: לפי שם
    { id: "c", date: "2026-09-03", actual: 50, area: "חלקה 6", areaId: "gone" },      // מזהה שלא במבנה: לפי שם
    { id: "d", date: "2026-09-04", actual: 10, area: "שדה ישן" }] } };                // שם שכבר לא קיים ובלי מזהה: בלי מיקום
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { ...NOMAP.settings, layout: { layout: plan, gen: {}, map: {}, ts: 1 } } } } });   // תוכנית סינתטית: אתר בלי מפת שולחנות, אחרת השולחנות האמיתיים נכנסים לבד (גרסה 22)
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const s = siteStagesState(1), L = currentLayout(); return { ids: Object.keys(s.F), f1: s.F.fx1.panels, f2: s.F.fx2.panels, un: s.U.panels, unList: siteStagesModel().unplaced().map(e => e.d),
    byId: targetById(L, "m1").name, idx: targetIndex({ areaId: "fx2", area: "חלקה 1" }, layoutTargets(L)), idxName: targetIndex({ area: "חלקה 1" }, layoutTargets(L)) }; });
  assert.deepStrictEqual(r.ids, ["tr-main", "m1", "fx1", "fx2"]);
  assert.ok(Math.abs(r.f1 - 0.2) < 1e-6, "חלקה 1 לפי areaId: " + r.f1); assert.ok(Math.abs(r.f2 - 0.3) < 1e-6, "חלקה 6 לפי שם: " + r.f2);
  assert.deepStrictEqual(r.un, { n: 1, q: 10 }); assert.deepStrictEqual(r.unList, ["d"]);
  assert.strictEqual(r.byId, "MVS 1"); assert.strictEqual(layoutTargetsIdx(r.idx), "fx2"); assert.strictEqual(layoutTargetsIdx(r.idxName), "fx1");   // המזהה קודם לשם
  function layoutTargetsIdx(i){ return ["tr-main", "m1", "fx1", "fx2"][i]; }
  // ensureIds: מזהה תקין נשמר; אלמנט בלי מזהה מקבל את המזהה של אותו שם במבנה הקודם; שם חדש מקבל מזהה חדש; כפילות מתוקנת
  const e = await page.evaluate(() => { const L = currentLayout();
    const a = ensureIds({ fields: [{ name: "חלקה 6" }, { name: "חדש" }, { id: "fx1", name: "אחר לגמרי" }], pads: [{ kind: "mvs", name: "MVS 1" }], trenches: [{ name: "תעלה ראשית" }, { id: "fx1", name: "x" }] }, L);
    const b = normLayout({ fields: [{ id: "same", name: "a", x: 0, y: 0, w: 10, h: 10 }, { id: "same", name: "b", x: 20, y: 0, w: 10, h: 10 }] });
    return { f: a.fields.map(f => f.id), p: a.pads.map(p => p.id), t: a.trenches.map(t => t.id), dup: b.fields.map(f => f.id) }; });
  assert.strictEqual(e.f[0], "fx2"); assert.strictEqual(e.f[2], "fx1"); assert.ok(e.f[1] && !["fx1", "fx2"].includes(e.f[1]), "שם חדש: מזהה חדש " + e.f[1]);
  assert.deepStrictEqual(e.p, ["m1"]); assert.strictEqual(e.t[0], "tr-main"); assert.notStrictEqual(e.t[1], "fx1");   // מזהה שכבר תפוס לא משוכפל
  assert.deepStrictEqual(e.dup, ["same", "same~2"]);
  await ctx.close();
});

test("שני מדדי התקדמות עם כותרת ו«הסבר»; שלב הכבלים נקרא «כבלים ושרוולים בתעלות» ותופס שרוולים; הטקסטים לא מבטיחים צביעה בלי מיקום", async () => {
  const st = { ...status, s1: { id: "s1", order: 9, name: "שרוולים בתעלות", unit: "מ׳", total: 500, daily: [D("2026-09-12", 100, "תעלה ראשית")] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st, ...NOMAP } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ ov: document.querySelector("#viewOver .mt-title").textContent.trim(), ss: document.querySelector("#stagesCard .mt-title").textContent.trim(), cap: document.querySelector("#ssCap").textContent,
    cable: PHASES.find(p => p.k === "cable").l, cableCard: document.querySelector("#ss_cable .k").textContent, cableSrc: document.querySelector("#ss_cable .src").textContent, cableV: document.querySelector("#ss_cable .v").textContent,
    legend: document.querySelector("#stagesCard .sb-keys").textContent, note: document.querySelector("#ssNote").textContent, cardNote: document.querySelector("#stagesCard > .note").textContent, empty: document.querySelector("#ssEmpty").textContent }));
  assert.ok(r.ov.startsWith("התקדמות חוזית"), r.ov); assert.ok(r.ss.startsWith("התקדמות במפה"), r.ss); assert.match(r.cap, /ממוצע פשוט/);
  assert.strictEqual(r.cable, "כבלים ושרוולים בתעלות"); assert.match(r.cableCard, /כבלים ושרוולים בתעלות/); assert.match(r.cableSrc, /שרוולים בתעלות/); assert.strictEqual(r.cableV, "600");   // 500 כבלים + 100 שרוולים
  assert.match(r.legend, /שרוול/);
  assert.doesNotMatch(r.note, /השאר לפי הסדר/); assert.match(r.note, /בתוך אותו שדה בלבד/); assert.match(r.note, /לא תוכנית הנדסית/);
  assert.match(r.cardNote, /דיווח בלי מיקום נספר בכמויות ולא במפה/); assert.match(r.empty, /עם מיקום/);
  // «הסבר» פותח את שני המדדים, משני המקומות
  await page.click("#ssWhy"); await page.waitForTimeout(150);
  const x1 = await page.evaluate(() => { const s = document.querySelector('.sheet[aria-label="שני מדדי התקדמות"]'); return s && s.textContent; });
  assert.match(x1, /התקדמות חוזית/); assert.match(x1, /התקדמות במפה/); assert.match(x1, /לא אמורים להיות שווים/);
  await page.click('.sheet[aria-label="שני מדדי התקדמות"] .cancel'); await page.waitForTimeout(100);
  await page.click("#ovWhy"); await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => !!document.querySelector('.sheet[aria-label="שני מדדי התקדמות"] .note.strong')));
  await ctx.close();
});

test("זום (גרסה 14, לחיצה אחת מגרסה 21): לחיצה על שדה נכנסת אליו עם הפירוט ומראה מה קרה שם ומה צריך להיות שם; לחיצה נוספת חוזרת למפה; תעלה, רשימה למקלדת, וציר הזמן", async () => {
  const plan = { fence: [0, 0, 1000, 700], fields: [{ name: "B1", x: 50, y: 300, w: 400, h: 350, rows: 10 }, { name: "B2", x: 550, y: 300, w: 400, h: 350, rows: 10 }],
    pads: [{ kind: "bess", name: "אגירה", x: 600, y: 50, w: 350, h: 120, units: 8 }, { kind: "mvs", name: "MVS 1", x: 100, y: 60, w: 80, h: 70 }],
    trenches: [{ name: "תעלה ראשית", pts: [[50, 250], [950, 250]] }] };
  const st = { p1: { id: "p1", order: 1, name: "התקנת פאנלים", unit: "יח׳", total: 1000, daily: [{ id: "x1", date: "2026-09-10", actual: 150, area: "B2", areaId: "f2", rows: [3, 5], crew: "צוות ב" }] },
    a1: { id: "a1", order: 2, name: "חפירת תעלות", unit: "מ׳", total: 2000, daily: [{ id: "y1", date: "2026-09-01", actual: 1000, area: "תעלה ראשית" }] },
    // «מה צריך להיות כאן»: הארקות בשדה (2 שדות → 500 לשדה; 500 ב-B2 = בוצע), הארקת יסוד באגירה (1 מתוך 2 = 50%), מגיני ברק דווחו בלי מיקום
    g1: { id: "g1", order: 3, name: "הארקות: פריסת גיד 25 ממ״ר על הקונסטרוקציה", unit: "מ׳", total: 1000, daily: [{ id: "g1a", date: "2026-09-12", actual: 500, area: "B2", areaId: "f2" }] },
    g2: { id: "g2", order: 4, name: "הארקת יסוד מתחם אגירה", unit: "קומפ׳", total: 2, daily: [{ id: "g2a", date: "2026-09-13", actual: 1, area: "אגירה" }] },
    g3: { id: "g3", order: 5, name: "מגיני ברק בתחנות MVS", unit: "סט", total: 2, daily: [{ id: "g3a", date: "2026-09-14", actual: 1 }] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { ...NOMAP.settings, layout: { layout: plan, gen: {}, map: {}, ts: 1 } } } } });   // תוכנית סינתטית: אתר בלי מפת שולחנות, אחרת השולחנות האמיתיים נכנסים לבד (גרסה 22)
  await page.evaluate(() => document.querySelector("#stagesCard").scrollIntoView()); await page.waitForTimeout(300);
  const box = await page.locator("#ssCv").boundingBox(); assert.ok(box && box.width > 200, "האיור לא צויר");
  const P = await page.evaluate(() => { const L = currentLayout(), f = L.fields[1], top = Math.min(22, f.h * .18), sp = (f.h - top - 4) / f.rows, tp = L.trenches[0].pts; return { w: L.w, h: L.h, fx: f.x + f.w * .6, row4: f.y + top + sp * 3.5, trench: [(tp[0][0] + tp[1][0]) / 2, tp[0][1]], n: 1 + L.trenches.length + L.pads.length + L.fields.length }; });
  const at = (x, y) => page.mouse.click(box.x + x / P.w * box.width, box.y + y / P.h * box.height);
  assert.strictEqual(await page.evaluate(() => siteStagesZoom()), null);
  await at(P.fx, P.row4); await page.waitForTimeout(600);   // שורה 4 בשדה B2
  const z1 = await page.evaluate(() => ({ z: siteStagesZoom(), hidden: document.querySelector("#ssZoom").hidden, txt: document.querySelector("#ssZoom").textContent, sel: document.querySelector("#ssZoomSel").value, rows: [...document.querySelectorAll("#ssZoom .zm-ph .zm-row")].map(r => r.querySelector(".k").textContent + " " + r.querySelector(".n").textContent) }));
  assert.deepStrictEqual({ id: z1.z.id, kind: z1.z.kind, row: z1.z.row }, { id: "f2", kind: "pv", row: 4 }); assert.ok(z1.z.s > 1.5, "המצלמה התקרבה: " + z1.z.s); assert.ok(z1.z.near > .99, "הציור המקורב: " + z1.z.near);
  assert.strictEqual(z1.hidden, false); assert.strictEqual(z1.sel, "f2"); assert.match(z1.txt, /B2 · שורה 4/);
  assert.deepStrictEqual(z1.rows.slice(0, 1), ["פאנלים 100%"]);   // 150 על שורות 3–5 של 50: השורה מלאה; שלבים שלא מקושרים לסעיף לא מוצגים
  assert.match(z1.txt, /150 יח׳ · התקנת פאנלים · שורות 3–5 · צוות ב/); assert.match(z1.txt, /10\.9/);
  // גרסה 21: «מה צריך להיות כאן» בשדה: הארקות בוצעו (500 מתוך 500 לשדה), ממירים/מנתקים «לא בסעיפים»; אין כפתורי פנימה/החוצה, יש «מפה»
  const sp1 = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#ssZoom .zm-spec .zm-row")].map(r => r.querySelector(".k").textContent + " | " + r.querySelector(".n").textContent), sum: document.querySelector("#ssZoom .zm-spec summary").textContent, inn: !!document.querySelector("#ssZoomIn"), out: !!document.querySelector("#ssZoomOut"), back: !!document.querySelector("#ssZoomBack") }));
  assert.ok(sp1.rows.some(r => /^הארקות.*\| בוצע · 12\.9/.test(r)), "הארקות בוצעו ב-B2: " + sp1.rows.join(" / ")); assert.ok(sp1.rows.some(r => /מנתק.*\| לא בסעיפים/.test(r)), sp1.rows.join(" / ")); assert.match(sp1.sum, /1 מתוך 6 בוצע/);
  assert.deepStrictEqual([sp1.inn, sp1.out, sp1.back], [false, false, true]);
  // לחיצה נוספת על האיור יוצאת ישר למפה המלאה (בלי רמות ביניים)
  await at(P.fx, P.row4); await page.waitForTimeout(600);
  const z2 = await page.evaluate(() => ({ z: siteStagesZoom(), hidden: document.querySelector("#ssZoom").hidden }));
  assert.deepStrictEqual(z2, { z: null, hidden: true });
  await at(...P.trench); await page.waitForTimeout(600);   // ומשם: תעלה
  const z3 = await page.evaluate(() => ({ z: siteStagesZoom(), rows: [...document.querySelectorAll("#ssZoom .zm-ph .zm-row")].map(r => r.querySelector(".k").textContent + " " + r.querySelector(".n").textContent), txt: document.querySelector("#ssZoom").textContent }));
  assert.strictEqual(z3.z.id, "t0"); assert.strictEqual(z3.z.kind, "trench"); assert.deepStrictEqual(z3.rows, ["חפירת תעלות 50%"]);
  assert.match(z3.txt, /1,000 מ׳ · חפירת תעלות/);
  // מהרשימה (מקלדת): אגירה; ואז «חזרה למפה» מהכרטיס
  await page.click("#ssZoomBack"); await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(() => [...document.querySelectorAll("#ssZoomSel option")].length), P.n);
  await page.selectOption("#ssZoomSel", "bess1"); await page.waitForTimeout(600);
  const z4 = await page.evaluate(() => ({ z: siteStagesZoom(), txt: document.querySelector("#ssZoom").textContent, rows: [...document.querySelectorAll("#ssZoom .zm-spec .zm-row")].map(r => r.querySelector(".k").textContent + " | " + r.querySelector(".n").textContent) }));
  assert.strictEqual(z4.z.kind, "bess"); assert.match(z4.txt, /אגירה/); assert.match(z4.txt, /אין עדיין דיווחים שמוקמו כאן/);
  assert.ok(z4.rows.some(r => /^הארקת יסוד.*\| 50%/.test(r)), "הארקת יסוד באגירה 1 מתוך 2: " + z4.rows.join(" / "));   // «מה צריך להיות כאן» גם כשאין שלבי ציור שדווחו
  // ב-MVS: מגיני ברק דווחו בלי מיקום → «דווח בלי מיקום»; הארקת התחנה «עוד לא» אין (אין סעיף) → «לא בסעיפים»
  await page.selectOption("#ssZoomSel", "mvs1"); await page.waitForTimeout(600);
  const z4m = await page.evaluate(() => [...document.querySelectorAll("#ssZoom .zm-spec .zm-row")].map(r => r.querySelector(".k").textContent + " | " + r.querySelector(".n").textContent));
  assert.ok(z4m.some(r => /^מגיני ברק \| דווח בלי מיקום/.test(r)), z4m.join(" / ")); assert.ok(z4m.some(r => /^הארקת התחנה \| לא בסעיפים/.test(r)), z4m.join(" / "));
  // ציר הזמן בתוך הזום: לפני הדיווחים הכרטיס אומר שאין עדיין, והאחוזים 0
  await page.selectOption("#ssZoomSel", "t0"); await page.waitForTimeout(600);
  await page.evaluate(() => { const r = document.querySelector("#ssRange"); r.value = 0; r.dispatchEvent(new Event("input", { bubbles: true })); }); await page.waitForTimeout(200);
  const z5 = await page.evaluate(() => ({ txt: document.querySelector("#ssZoom").textContent, dig: document.querySelector("#ssZoom .zm-ph .zm-row .n").textContent }));
  assert.match(z5.txt, /עד התאריך הזה/); assert.strictEqual(z5.dig, "0%");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

// גרסה 15: בזום על אגירה מצויר איור איזומטרי חתוך (מכולות על משטח), והפנים משקף את הדיווח; לסוגים בלי איור הדיספאצ'ר מחזיר false
test("איור איזומטרי (גרסה 15–16): אגירה, סקיד/MVS, חדר חשמל, שורה ותעלה מצוירים; הפנים לפי השלבים; חדר החשמל נכנס לזום", async () => {
  const browser = await launch();
  try {
  const plan = { fence: [0, 0, 1000, 700], fields: [{ name: "B1", x: 50, y: 300, w: 400, h: 350, rows: 10 }], pads: [{ kind: "bess", name: "אגירה", x: 600, y: 50, w: 350, h: 120, units: 8 }, { kind: "room", name: "חדר חשמל", x: 100, y: 60, w: 90, h: 70 }], trenches: [{ id: "tr1", name: "תעלה ראשית", pts: [[50, 250], [950, 250]] }] };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: {}, settings: { ...NOMAP.settings, layout: { layout: plan, gen: {}, map: {}, ts: 1 } } } } });   // תוכנית סינתטית: אתר בלי מפת שולחנות, אחרת השולחנות האמיתיים נכנסים לבד (גרסה 22)
  await page.evaluate(() => document.querySelector("#stagesCard").scrollIntoView()); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const count = (F) => { const c = document.createElement("canvas"); c.width = 400; c.height = 260; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 400, 260);
      const ok = isoScene(x, { x: 0, y: 0, w: 400, h: 260 }, { kind: "bess", units: 8 }, F, 1, 1); const d = x.getImageData(0, 0, 400, 260).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++; return { ok, n }; };
    const other = (() => { const c = document.createElement("canvas"); c.width = 10; c.height = 10; return isoScene(c.getContext("2d"), { x: 0, y: 0, w: 10, h: 10 }, { kind: "zzz" }, {}, 1, 1); })();
    const draw = (el, F) => { const c = document.createElement("canvas"); c.width = 400; c.height = 260; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 400, 260); const ok = isoScene(x, { x: 0, y: 0, w: 400, h: 260 }, el, F, 1, 1); const d = x.getImageData(0, 0, 400, 260).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++; return ok ? n : -1; };
    const kinds = { mvs: draw({ kind: "mvs" }, { base: 1, conc: 1, skid: 1, wire: 1 }), skid: draw({ kind: "skid" }, { base: 1, conc: 1, skid: 1, wire: 1 }), room: draw({ kind: "room" }, {}), pv: draw({ kind: "pv", rows: 10 }, { piles: 1, panels: 1, strings: 1 }), trench: draw({ kind: "trench" }, { dig: 1, cable: 1, cover: 1 }), pvEmpty: draw({ kind: "pv", rows: 10 }, {}) };
    return { kinds: ISO_KINDS, other, each: kinds, empty: count({}), padOnly: count({ base: 1, conc: 1 }), placed: count({ base: 1, conc: 1, bess: 1 }), wired: count({ base: 1, conc: 1, bess: 1, wire: 1 }) };
  });
  assert.deepStrictEqual(r.kinds, ["bess", "mvs", "skid", "room", "pv", "trench"]); assert.strictEqual(r.other, false);
  for (const k of ["mvs", "skid", "room", "pv", "trench"]) assert.ok(r.each[k] > 2000, k + " מצויר: " + r.each[k]);
  assert.ok(r.each.pv > r.each.pvEmpty * 1.1, "שורה עם פאנלים מצוירת יותר משורה ריקה: " + r.each.pv + " מול " + r.each.pvEmpty);
  assert.ok(r.empty.ok && r.padOnly.ok && r.placed.ok && r.wired.ok);
  assert.ok(r.empty.n > 50, "לפני הכל: מתאר מקווקו " + r.empty.n);
  assert.ok(r.padOnly.n > r.empty.n, "משטח מוסיף ציור"); assert.ok(r.placed.n > r.padOnly.n * 1.2, "מכולות שהוצבו: " + r.placed.n + " מול " + r.padOnly.n); assert.ok(r.wired.n > r.placed.n, "ציוד בפנים כשחובר: " + r.wired.n + " מול " + r.placed.n);
  // בזום על האגירה האיור האיזומטרי מצויר (near=1) והכרטיס עדיין מדבר על האגירה
  await page.evaluate(() => zoomTo("bess1")); await page.waitForTimeout(700);   // בלי דיווחים הרשימה למקלדת מוסתרת, אז דרך הפונקציה
  const z = await page.evaluate(() => ({ z: siteStagesZoom(), txt: document.querySelector("#ssZoom").textContent }));
  assert.strictEqual(z.z.kind, "bess"); assert.ok(z.z.near > .99); assert.match(z.txt, /אגירה/);
  // חדר החשמל: אין לו שלבים, אבל נכנסים אליו בזום ורואים את האיור; הכרטיס אומר שהאיור כמתוכנן
  await page.evaluate(() => zoomTo("room1")); await page.waitForTimeout(700);
  const zr = await page.evaluate(() => ({ z: siteStagesZoom(), txt: document.querySelector("#ssZoom").textContent }));
  assert.strictEqual(zr.z.kind, "room"); assert.ok(zr.z.near > .99); assert.match(zr.txt, /חדר חשמל/); assert.match(zr.txt, /כמתוכנן/);
  // גרסה 21: הפירוט (תוויות, מידות, ציוד קטן) נכנס כבר בלחיצה הראשונה: בזום על החדר האיור המפורט (detail 2) מצויר יותר מהאיור הנקי (detail 1) של אותו חדר
  const det = await page.evaluate(() => { const n = d => { const c = document.createElement("canvas"); c.width = 600; c.height = 400; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 600, 400); isoScene(x, { x: 0, y: 0, w: 600, h: 400 }, { kind: "room" }, {}, 1, 1, { detail: d }); const p = x.getImageData(0, 0, 600, 400).data; let k = 0; for (let i = 0; i < p.length; i += 4) if (p[i] < 235 || p[i + 1] < 235 || p[i + 2] < 235) k++; return k; };
    // «מתוכנן מול בוצע»: פריט שעוד לא בוצע (spec 0) מצויר מקווקו-חיוור, ולכן פחות פיקסלים כהים מאשר כשבוצע (1)
    const s = sp => { const c = document.createElement("canvas"); c.width = 600; c.height = 400; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 600, 400); isoScene(x, { x: 0, y: 0, w: 600, h: 400 }, { kind: "room" }, {}, 1, 1, { spec: sp }); const p = x.getImageData(0, 0, 600, 400).data; let k = 0; for (let i = 0; i < p.length; i += 4) if (p[i] < 200 || p[i + 1] < 200 || p[i + 2] < 200) k++; return k; };
    return { d1: n(1), d2: n(2), todo: s({ boards: 0, gen: 0, mvboard: 0, ducts: 0 }), done: s({ boards: 1, gen: 1, mvboard: 1, ducts: 1 }) }; });
  assert.ok(det.d2 > det.d1 * 1.03, "הפירוט מוסיף ציור: " + det.d2 + " מול " + det.d1); assert.ok(det.done > det.todo * 1.05, "בוצע כהה ממתוכנן: " + det.done + " מול " + det.todo);
  assert.strictEqual((await page.evaluate(() => siteStagesZoom())).level, undefined);   // אין יותר רמות
  // תעלה: במבנה אין לה kind, ובכל זאת בזום מצויר החתך (הקנבס לא נשאר לבן)
  await page.evaluate(() => zoomTo("tr1")); await page.waitForTimeout(700);
  const zt = await page.evaluate(() => { const c = document.querySelector("#ssCv"), x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) n++; return { z: siteStagesZoom(), n, px: c.width * c.height }; });
  assert.strictEqual(zt.z.kind, "trench"); assert.ok(zt.z.near > .99); assert.ok(zt.n > zt.px * .04, "חתך התעלה מצויר בזום: " + zt.n + " מתוך " + zt.px);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
  } finally { await browser.close(); }
});

// גרסה 20–21: מופע MSE (forSite לפי src/sites.json) עם מפה פיקטיבית לבאר טוביה: מפת האתר מצוירת עם 333 שולחנות במקומם ואומרת שהמפה פיקטיבית,
// תבנית סוגי הכבלים גנרית, אין תבנית כתב כמויות (אין כמויות), ושום «עין תמר»
test("מופע MSE: מפה פיקטיבית לבאר טוביה עם השולחנות במקומם, כרטיס אחד, תבנית סוגי כבלים גנרית, בלי «עין תמר»", async () => {
  const { build, forSite } = require("../tools/build");
  const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "sites.json"), "utf8"));
  const file = path.join(require("os").tmpdir(), "yoman-mse-test.html"); fs.writeFileSync(file, forSite(build(), sites.mse));
  const st = { p1: { id: "p1", code: "4.2", name: "התקנת פאנלים", order: 1, total: 27945, unit: "יח׳", workDays: 90, start: "2026-07-19", daily: [{ date: "2026-07-19", actual: 500 }, { date: "2026-08-20", actual: 9000 }] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st } }, file });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => { const L = currentLayout(); return { build: !!document.querySelector("#buildCard"), cvw: document.querySelector("#ssCv").width, note: document.querySelector("#ssNote").textContent, big: document.querySelector("#ssBig").textContent,
    title: document.querySelector("#stagesCard h3").childNodes[0].textContent, tables: siteMap().tables.length, placed: L.tables && L.tables.n, fields: L.fields.length, einTamar: document.documentElement.outerHTML.includes("עין תמר") }; });
  assert.strictEqual(r.build, false); assert.ok(r.cvw > 0, "הקנבס לא צויר");
  assert.match(r.note, /פיקטיבית/); assert.strictEqual(r.big, "34%");   // 9,500 / 27,945
  assert.strictEqual(r.title, "מפת האתר"); assert.strictEqual(r.tables, 333); assert.strictEqual(r.placed, 333); assert.strictEqual(r.einTamar, false);
  await page.evaluate(() => openCableTypes());
  const ct = page.locator("#ctTpl"); assert.strictEqual(await ct.count(), 1);
  const label = await ct.textContent(); assert.match(label, /נפוצים/); assert.doesNotMatch(label, /עין תמר|ההסכם/);
  await ct.click(); assert.ok(await page.locator("#ctRows .card").count() >= 15, "התבנית לא טענה סוגי כבלים");
  await page.evaluate(() => document.querySelector("#ctRows").closest(".sheet").querySelector(".cancel").click());
  await page.evaluate(() => openBoqImport());
  assert.strictEqual(await page.locator("#bqTpl").count(), 0, "כפתור תבנית כתב כמויות בלי תבנית");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  await ctx.close();
});
