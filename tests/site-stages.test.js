// «האתר לפי שלבים»: האיור ניזון מדיווחי הביצוע, אזור בדיווח צובע את היעד שלו, ושלב מאוחר מושך בציור את הקודמים.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
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
    return { bad, zero, fC: s.F.f3.panels, fB: s.F.f2.panels, fA: s.F.f1.panels, bess: s.F.bess.bess, bessConc: s.F.bess.conc, f3piles: s.F.f3.piles };
  });
  assert.strictEqual(r.bad, 0);
  assert.strictEqual(r.zero, true);
  assert.strictEqual(r.fC, 1);            // 2,000 פאנלים ב«שדה C» = הקיבולת של שדה C (8,000 / 4 שדות)
  assert.strictEqual(r.fB, 0);            // ולא בשדה B
  assert.strictEqual(r.fA, 1);            // השרשור בלי אזור נכנס לשדה A לפי הסדר, ומושך את הפאנלים שלו
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

test("בלי סטטוס: הכרטיס מסביר ולא נופל", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ empty: document.querySelector("#ssEmpty").hidden, body: document.querySelector("#ssBody").hidden }));
  assert.deepStrictEqual(r, { empty: false, body: true });
  await ctx.close();
});

test("מבנה מתוכנית (JSON): שדות, משטחים ותעלות במיקומם, אזור בדיווח צובע את השדה הנכון", async () => {
  const plan = { fence: [0, 0, 1000, 700], fields: [{ name: "B1", x: 50, y: 300, w: 400, h: 350, rows: 12 }, { name: "B2", x: 550, y: 300, w: 400, h: 350, rows: 12 }],
    pads: [{ kind: "bess", name: "אגירה", x: 600, y: 50, w: 350, h: 120, units: 8 }, { kind: "mvs", name: "MVS 1", x: 100, y: 60, w: 80, h: 70 }],
    trenches: [{ name: "תעלה ראשית", pts: [[50, 250], [950, 250]] }, { name: "תעלה B2", pts: [[750, 250], [750, 320]] }] };
  const st = { p1: { id: "p1", order: 1, name: "התקנת פאנלים", unit: "יח׳", total: 1000, daily: [{ id: "x1", date: "2026-09-01", actual: 500, area: "B2" }] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st, settings: { layout: { layout: plan, gen: {}, map: {}, ts: 1 } } } } });
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
});
