// «האתר נבנה» בדאשבורד: הכרטיס נבנה מהסטטוס של המופע, שומר על סדר הביצוע בציור, ומציג מצב «אין מפה» לאתר בלי מפה.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { launch, openApp, ROOT } = require("./helpers");
const fixture = require("./fixture");


// סטטוס סינתטי: ארבע פעילויות עם רישומים יומיים (בלי נתוני חברה)
const status = {
  st_1: { id: "st_1", name: "קידוחים", order: 1, total: 1000, workDays: 60, start: "2026-08-03", daily: [ { date: "2026-08-03", actual: 100 }, { date: "2026-08-20", actual: 300 }, { date: "2026-09-10", actual: 200 } ] },
  st_2: { id: "st_2", name: "יציקות", order: 2, total: 1000, workDays: 60, start: "2026-08-05", daily: [ { date: "2026-08-05", actual: 50 }, { date: "2026-08-25", actual: 250 }, { date: "2026-09-12", actual: 200 } ] },
  st_3: { id: "st_3", name: "קונסטרוקציה (שולחנות)", order: 3, total: 258, workDays: 70, start: "2026-08-10", daily: [ { date: "2026-08-10", actual: 2 }, { date: "2026-09-01", actual: 18 }, { date: "2026-09-20", actual: 20 } ] },
  st_4: { id: "st_4", name: "פאנלים", order: 4, total: 18630, workDays: 80, start: "2026-09-09", daily: [ { date: "2026-09-09", actual: 243 }, { date: "2026-09-25", actual: 1000 }, { date: "2026-10-05", actual: 1500 } ] },
  st_5: { id: "st_5", name: "TML", order: 5, total: 100, workDays: 20, daily: [] },
};

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("עין תמר: הכרטיס מציג את המצטבר מהסטטוס, שרטוט, ובלי גלילה אופקית ב-400", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => {
    const vals = [...document.querySelectorAll("#sbStats .sb-stat")].filter(e => !e.hidden).map(e => e.querySelector(".v").textContent);
    const cv = document.querySelector("#sbCv");
    return { hidden: document.querySelector("#sbBody").hidden, empty: document.querySelector("#sbEmpty").hidden, vals, cvw: cv.width, nomap: document.querySelector("#sbNoMap").hidden,
      big: document.querySelector("#sbBig").textContent, ms: document.querySelectorAll("#sbMs li").length, sum: (document.querySelector("#sum_build") || {}).textContent };
  });
  assert.strictEqual(r.hidden, false); assert.strictEqual(r.empty, true); assert.strictEqual(r.nomap, true);
  assert.deepStrictEqual(r.vals, ["600", "500", "40", "2,743"]);   // המצטבר של כל פעילות, היום
  assert.strictEqual(r.big, "15%");                                   // 2,743 / 18,630
  assert.ok(r.cvw > 0, "הקנבס לא צויר");
  assert.ok(r.ms >= 4, "אבני דרך: " + r.ms);
  assert.strictEqual(r.sum, "15% פאנלים");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  await ctx.close();
});

test("הציור שומר על סדר הביצוע בכל נקודת זמן: נקדח ≥ יצוק ≥ קונסטרוקציה ≥ פאנלים", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
  const bad = await page.evaluate(() => {
    let bad = 0;
    for (let k = 0; k <= 100; k++){
      const s = siteBuildState(k / 100); const T = s.panF.length;
      let d = 0, c = 0, st = 0, stT = 0, pt = 0;
      for (let i = 0; i < T; i++){ d += s.drillF[i]; c += s.castF[i]; st += s.strF[i]; stT += s.strF[i]; pt += s.panF[i]; }
      for (let i = 0; i < T; i++) if (s.strF[i] > 0 && s.castF[i] < 1 - 1e-6) bad++;       // שולחן על עמודים שלא נוצקו
      for (let i = 0; i < T; i++) if (s.panF[i] > s.strF[i] + 1e-6 || s.castF[i] > s.drillF[i] + 1e-6) bad++;
      if (!(d >= c - 1e-3 && c >= st - 1e-3 && stT >= pt - 1e-3)) bad++;
    }
    const today = siteBuildState(1);
    return { bad, today: [Math.round(today.v.drill), Math.round(today.v.cast), Math.round(today.v.tables), Math.round(today.v.panels)], start: siteBuildState(0).v.panels };
  });
  assert.strictEqual(bad.bad, 0);
  assert.deepStrictEqual(bad.today, [600, 500, 40, 2743]);   // הכרטיסים מראים את המספרים האמיתיים גם כשהציור מיושר
  assert.strictEqual(bad.start, 0);                           // בתחילת הציר השטח ריק
  await ctx.close();
});

test("אתר בלי מפה: המספרים מוצגים, השרטוט לא, ויש הודעה ברורה", async () => {
  const site = { name: "אתר בדיקה בלי מפה", company: "S.E.E", ts: 1 };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status, settings: { site } } } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ nomap: document.querySelector("#sbNoMap").hidden, text: document.querySelector("#sbNoMap").textContent, cv: document.querySelector("#sbCvw").hidden,
    vals: [...document.querySelectorAll("#sbStats .sb-stat")].filter(e => !e.hidden).map(e => e.querySelector(".v").textContent), sum: (document.querySelector("#sum_build") || {}).textContent }));
  assert.strictEqual(r.nomap, false); assert.match(r.text, /אין עדיין מפת שולחנות/); assert.strictEqual(r.cv, true);
  assert.deepStrictEqual(r.vals, ["600", "500", "40", "2,743"]);
  assert.strictEqual(r.sum, "15% פאנלים · אין מפה");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  await ctx.close();
});

test("בלי סטטוס: הכרטיס מסביר מה חסר ולא נופל", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ empty: document.querySelector("#sbEmpty").hidden, body: document.querySelector("#sbBody").hidden }));
  assert.deepStrictEqual(r, { empty: false, body: true });
  await ctx.close();
});

// גרסה 20: מופע MSE (forSite לפי src/sites.json) עם מפה פיקטיבית לבאר טוביה: הכרטיס «האתר נבנה» מצויר ואומר שהמפה פיקטיבית,
// כרטיס השלבים נשאר «האתר לפי שלבים» כמו ב-S.E.E, תבנית סוגי הכבלים גנרית, אין תבנית כתב כמויות (אין כמויות), ושום «עין תמר»
test("מופע MSE: מפה פיקטיבית לבאר טוביה, שני הכרטיסים, תבנית סוגי כבלים גנרית, בלי «עין תמר»", async () => {
  const { build, forSite } = require("../tools/build");
  const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "sites.json"), "utf8"));
  const file = path.join(require("os").tmpdir(), "yoman-mse-test.html"); fs.writeFileSync(file, forSite(build(), sites.mse));
  // סטטוס סינתטי של קבלן חשמל: רק «התקנת פאנלים» מתאים לשלבי הבנייה
  const st = { p1: { id: "p1", code: "4.2", name: "התקנת פאנלים", order: 1, total: 27945, unit: "יח׳", workDays: 90, start: "2026-07-19", daily: [{ date: "2026-07-19", actual: 500 }, { date: "2026-08-20", actual: 9000 }] } };
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: { ...fixture, status: st } }, file });
  assert.deepStrictEqual(errors, []);
  const r = await page.evaluate(() => ({ build: document.querySelector("#buildCard").hidden, nomap: document.querySelector("#sbNoMap").hidden, cvw: document.querySelector("#sbCv").width,
    note: document.querySelector("#sbNote").textContent, big: document.querySelector("#sbBig").textContent, title: document.querySelector("#stagesCard h3").childNodes[0].textContent,
    tables: siteMap().tables.length, einTamar: document.documentElement.outerHTML.includes("עין תמר") }));
  assert.strictEqual(r.build, false); assert.strictEqual(r.nomap, true); assert.ok(r.cvw > 0, "הקנבס לא צויר");
  assert.match(r.note, /פיקטיבית/); assert.strictEqual(r.big, "34%");   // 9,500 / 27,945
  assert.strictEqual(r.title, "האתר לפי שלבים"); assert.strictEqual(r.tables, 333); assert.strictEqual(r.einTamar, false);
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
