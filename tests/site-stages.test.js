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

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("האיור מופיע מהסטטוס, הכמויות אמיתיות, בלי גלילה אופקית ב-400", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
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
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
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
