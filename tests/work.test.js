// ניהול העבודה (שלב 3): פעילויות מתבנית, דיווח ביצוע של כמה צוותים באותו יום, חריגים, סיכום יומי,
// קטגוריות חשמל, ודוח שבועי עם מאזן כבלים / מלאי קריטי / כוח אדם / חריגים. נתונים סינתטיים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const docs = (page, coll) => page.evaluate(c => [...window.__MOCK_STORE__.entries()]
  .filter(([k]) => k.startsWith(c + "/")).map(([, v]) => JSON.parse(JSON.stringify(v))), coll);
const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => isoOf(new Date());
const worker = (id, date, name, contractor, hours) => ({ id, date, ts: new Date(date + "T12:00:00").getTime(), name, contractor, job: contractor ? "עוזר חשמלאי" : "חשמלאי מוסמך", hours: hours || 0, arrive: "ontime", leave: "ontime" });

test("תבנית פעילויות: נטענת עם קבוצות, נשמרת, ושמירה חוזרת מעדכנת כמות בלי למחוק דיווחים", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openActivityTemplate());
  assert.strictEqual(await page.locator(".atrow").count(), 9);
  await page.locator('.atrow[data-i="0"] input[data-k="total"]').fill("42000");   // מתקנים כמות
  await page.locator('.atrow[data-i="8"] .x').click();                             // מוחקים את «בדיקות סטרינגים»
  await page.click("#atSave");
  await page.waitForFunction(() => shared.STATUS.length === 8);
  const st = await docs(page, "status");
  const dc = st.find(a => a.name === "משיכת כבלי DC");
  assert.deepStrictEqual([dc.total, dc.unit, dc.workDays, dc.group, dc.start], [42000, "מ׳", 60, "DC", "2026-11-23"]);
  assert.ok(!st.some(a => a.name === "בדיקות סטרינגים"));
  const list = await page.textContent("#statusList");
  for (const s of ["DC", "הארקה", "משיכת כבלי DC", "מ׳"]) assert.ok(list.includes(s), "חסר ברשימת הסטטוס: " + s);
  assert.strictEqual(await page.textContent("#ovBig"), "0%");
  // דיווח ביצוע, ואז שמירה חוזרת של הפעילויות עם כמות אחרת: הדיווח נשאר
  await page.evaluate(id => openWorkReport({ activityId: id }), dc.id);
  await page.fill("#prQty", "500"); await page.fill("#prArea", "שדה 1"); await page.fill("#prCrew", "צוות א");
  await page.click("#prSave");
  await page.waitForFunction(id => (shared.STATUS.find(a => a.id === id).daily || []).length === 1, dc.id);
  await page.evaluate(() => openActivityTemplate());
  assert.strictEqual(await page.locator(".atrow").count(), 9);                     // 8 קיימות + «בדיקות סטרינגים» מהתבנית
  assert.match(await page.textContent('.atrow[data-i="0"]'), /קיימת · 500 דווחו/);
  await page.locator('.atrow[data-i="0"] input[data-k="total"]').fill("45000");
  await page.click("#atSave");
  await page.waitForFunction(id => shared.STATUS.find(a => a.id === id).total === 45000, dc.id);
  const dc2 = (await docs(page, "status")).find(a => a.id === dc.id);
  assert.deepStrictEqual(dc2.daily.map(d => [d.actual, d.area, d.crew]), [[500, "שדה 1", "צוות א"]]);
  assert.strictEqual((await docs(page, "status")).length, 9);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("דיווח ביצוע: שני צוותים באותו יום נשמרים זה לצד זה, הרישום המהיר לא מוחק אותם, והתפוקה מופיעה אצל הקבלן", async () => {
  const T = today();
  const status = { st_1: { id: "st_1", name: "הארקה", unit: "מ׳", order: 1, total: 8000, workDays: 40, start: "2026-10-01", group: "הארקה", daily: [] } };
  const daylog = { d1: worker("d1", T, "עובד א", ""), d2: worker("d2", T, "עובד ב", "קבלן משנה ב", 9) };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status, daylog } } });
  await page.evaluate(() => openWorkReport());
  await page.selectOption("#prAct", "st_1");
  assert.match(await page.textContent("#prHint"), /נדרש/);
  await page.fill("#prQty", "300"); await page.fill("#prArea", "שדה 1"); await page.fill("#prCrew", "צוות א");
  await page.click("#prSave");
  await page.waitForFunction(() => (shared.STATUS[0].daily || []).length === 1);
  await page.evaluate(() => openWorkReport({ activityId: "st_1" }));
  await page.fill("#prQty", "200"); await page.fill("#prArea", "שדה 2"); await page.fill("#prCrew", "קבלן משנה ב");
  await page.click("#prSave");
  await page.waitForFunction(() => (shared.STATUS[0].daily || []).length === 2);
  // רישום מהיר של אותו יום נוסף לצד הדיווחים, ורישום מהיר שני מחליף רק אותו
  await page.evaluate(() => openStatusEntry(shared.STATUS[0]));
  await page.fill("#seQty", "50"); await page.click("#seSave");
  await page.waitForFunction(() => (shared.STATUS[0].daily || []).length === 3);
  assert.deepStrictEqual((await docs(page, "status"))[0].daily.map(d => [d.actual, d.crew || ""]).sort(), [[200, "קבלן משנה ב"], [300, "צוות א"], [50, ""]].sort());
  assert.strictEqual(await page.evaluate(() => statusCalc(shared.STATUS[0], new Set()).done), 550);
  await page.evaluate(() => openStatusEntry(shared.STATUS[0]));
  await page.fill("#seQty", "70"); await page.click("#seSave");
  await page.waitForFunction(() => statusCalc(shared.STATUS[0], new Set()).done === 570);
  assert.strictEqual((await docs(page, "status"))[0].daily.length, 3);
  // לשונית עובדים: «בוצע ביום הזה», וסיכום הקבלן עם תפוקה
  await page.click("#tabDay");
  const wk = await page.textContent("#dyWork");
  for (const s of ["הארקה", "שדה 1 · צוות א", "קבלן משנה ב", "300", "200"]) assert.ok(wk.includes(s), "חסר ב«בוצע ביום הזה»: " + s);
  // כרטיס סיכום הקבלן מקופל כברירת מחדל: פותחים אותו בלחיצה על הכותרת, כמו משתמש
  await page.evaluate(() => { const c = document.querySelector('[data-fold="consum"]'); if (c.classList.contains("folded")) c.querySelector(":scope>h3").click(); });
  await page.click('#csCon [data-c="קבלן משנה ב"]');
  const cs = await page.textContent("#csBody");
  assert.match(cs, /תפוקה שדווחה/); assert.match(cs, /200/); assert.match(cs, /9 שעות/);
  await page.click('#csCon [data-c="ללא קבלן"]');
  assert.match(await page.textContent("#csBody"), /370/);     // צוות א + הרישום המהיר נספרים כשלנו
  // עריכת דיווח מתוך הרשימה: לחיצה פותחת את הדיווח עם הערכים שלו
  await page.locator("#dyWork .slip").first().click();
  assert.strictEqual(await page.inputValue("#prQty"), "300");
  assert.strictEqual(await page.inputValue("#prCrew"), "צוות א");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("חריגים: התרעה מעל 3 ימים, פתיחה, הצגה בסיכום היומי, וסגירה", async () => {
  const T = today(), old = new Date(Date.now() - 5 * 864e5);
  const status = { st_1: { id: "st_1", name: "הארקה", unit: "מ׳", order: 1, total: 8000, workDays: 40, start: "2026-10-01", daily: [{ id: "wr1", date: T, actual: 400, area: "שדה 1", crew: "צוות א", ts: Date.now() }] } };
  const blockers = { b0: { id: "b0", ts: old.getTime(), date: isoOf(old), text: "חסר מהדקי הארקה", kind: "material", area: "שדה 1", status: "open" } };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status, blockers } } });
  await page.waitForFunction(() => !document.querySelector("#ovAlerts").hidden);
  assert.match(await page.textContent("#ovAlerts"), /חריגים פתוחים יותר משלושה ימים/);
  assert.match(await page.textContent("#blkList"), /חסר מהדקי הארקה/);
  assert.match(await page.textContent("#sum_blk"), /1 פתוחים · 1 מעל 3 ימים/);
  await page.evaluate(() => openBlocker());
  await page.click('#bkKind [data-k="decision"]');
  await page.fill("#bkText", "צריך אישור יועץ לתוואי התעלה"); await page.fill("#bkArea", "שדה 2");
  await page.click("#bkSave");
  await page.waitForFunction(() => (shared.blockers || []).length === 2);
  const b = (await docs(page, "blockers")).find(x => x.id !== "b0");
  assert.deepStrictEqual([b.kind, b.area, b.status, b.date], ["decision", "שדה 2", "open", T]);
  // סיכום יומי לפי התבנית
  const txt = await page.evaluate(t => dailySummaryText(t), T);
  assert.match(txt, /^יומן חשמל · /);
  assert.match(txt, /בוצע היום: הארקה: 400 מ׳/);
  assert.match(txt, /מול תכנון: הארקה 5% \(קצב נדרש \d+ ליום, בפועל 400\)/);
  assert.match(txt, /חריגים: חסר מהדקי הארקה \(שדה 1\) · צריך אישור יועץ לתוואי התעלה \(שדה 2\)/);
  // סגירה
  await page.evaluate(id => openBlocker(shared.blockers.find(x => x.id === id)), "b0");
  await page.click('#bkSt [data-v="closed"]'); await page.fill("#bkClose", "הגיעו 2 קרטונים");
  await page.click("#bkSave");
  await page.waitForFunction(() => (shared.blockers || []).find(x => x.id === "b0").status === "closed");
  const closed = (await docs(page, "blockers")).find(x => x.id === "b0");
  assert.strictEqual(closed.closeNote, "הגיעו 2 קרטונים"); assert.ok(closed.closedAt > 0);
  assert.match(await page.textContent("#blkList"), /נסגרו לאחרונה/);
  assert.doesNotMatch(await page.evaluate(t => dailySummaryText(t), T), /חסר מהדקי/);
  // סיכום לוואטסאפ: ברירת המחדל היא הסיכום היומי
  await page.evaluate(() => openWa());
  assert.match(await page.inputValue("#waText"), /בוצע היום: הארקה/);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("קטגוריות חשמל: ארבע קטגוריות, רשומות ישנות מתורגמות, והשם קובע כשאין קטגוריה", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: fixture } });
  const r = await page.evaluate(() => ({ ids: CATS.map(c => c.id), rows: Object.fromEntries(stockRows().map(x => [x.name, x.cat])),
    norm: [catId("staging"), catId("electrical", "כבל סולארי 6"), catId("electrical", "מחבר MC4"), catId("construction", "בורג M8"), catId("tools"), catId("", "אזיקונים 200")],
    guess: [catGuess("מולטימטר"), catGuess("תעלת רשת 200"), catGuess("סרט בידוד"), catGuess("תוף כבל 4x16")] }));
  assert.deepStrictEqual(r.ids, ["cables", "install", "consumables", "tools"]);
  assert.deepStrictEqual(r.rows, { "בורג M8": "install", "כבל סולארי 6": "cables", "מקדחה": "tools" });
  assert.deepStrictEqual(r.norm, ["consumables", "cables", "install", "install", "tools", "consumables"]);
  assert.deepStrictEqual(r.guess, ["tools", "install", "consumables", "cables"]);
  await ctx.close();
});

test("דוח שבועי למנהלים: מאזן כבלים, מלאי קריטי, כוח אדם וחריגים; ליזם בלי כל אלה", async () => {
  const T = today();
  const cableTypes = { ts: 1, types: [{ code: "DC6-BK", desc: "כבל סולארי 6 שחור", boqCode: "1.1", aliases: [] }] };
  const boq = { source: "בדיקה", lines: [{ code: "1.1", name: "כבל סולארי 6 שחור", qty: 3000, unit: "מ'" }, { code: "2.1", name: "מהדק הארקה", qty: 400, unit: "יח'" }] };
  const status = { st_1: { id: "st_1", name: "הארקה", unit: "מ׳", order: 1, total: 8000, workDays: 40, start: "2026-10-01", daily: [{ id: "wr1", date: T, actual: 400, area: "שדה 1", crew: "צוות א", ts: Date.now() }] } };
  const drums = { dr1: { id: "dr1", drumNo: "1001", cableType: "DC6-BK", lengthIn: 1000, status: "inUse", ts: Date.now() } };
  const pulls = { pl1: { id: "pl1", drumId: "dr1", drumNo: "1001", cableType: "DC6-BK", meters: 300, date: T, ts: Date.now() } };
  const daylog = { d1: worker("d1", T, "עובד א", ""), d2: worker("d2", T, "עובד ב", "קבלן משנה ב", 9) };
  const blockers = { b1: { id: "b1", ts: Date.now(), date: T, text: "חסר מהדקי הארקה", kind: "material", area: "שדה 1", status: "open" } };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status, daylog, drums, pulls, blockers, settings: { cableTypes, boq } } } });
  const r = await page.evaluate(t => { const D = wrData(t); return { mgr: wrHtml("mgr", D, {}), client: wrHtml("client", D, {}), txt: wrText("mgr", D, {}), man: D.man, pulled: D.pulledW, crit: D.crit.map(c => c.name), workN: D.workN }; }, T);
  assert.deepStrictEqual([r.man.days, r.man.manDays, r.man.avg, r.man.subDays, r.man.subHours, r.pulled, r.workN], [1, 2, 2, 1, 9, 300, 1]);
  assert.deepStrictEqual(r.crit, ["כבל סולארי 6 שחור", "מהדק הארקה"]);
  for (const s of ["מאזן כבלים", "כבל סולארי 6 שחור", "מלאי קריטי", "מהדק הארקה", "כוח אדם", "ימי עובד קבלן משנה", "בעיות והחלטות נדרשות", "חסר מהדקי הארקה"]) assert.ok(r.mgr.includes(s), "חסר בדוח למנהלים: " + s);
  for (const s of ["מאזן כבלים", "מלאי קריטי", "כוח אדם", "חסר מהדקי הארקה", "קבלן משנה ב"]) assert.ok(!r.client.includes(s), "ליזם לא אמור לכלול: " + s);
  assert.match(r.txt, /כוח אדם: 1 ימי עבודה · ממוצע 2 עובדים ליום · 1 ימי עובד קבלן משנה/);
  assert.match(r.txt, /כבלים: נמשכו 300 מ׳ השבוע/);
  assert.match(r.txt, /חריגים פתוחים:\n• חסר מהדקי הארקה \(שדה 1\)/);
  await page.evaluate(() => openWeekly());
  await page.waitForSelector("#wrFrame");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
