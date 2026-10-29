// דיווח בדיבור (גרסה 9): טקסט חופשי → Claude (מדומה) → פריטים לאישור → עובדים, דיווח ביצוע לפי סעיף, חריג, ציוד וטקסט היום.
// ובלי AI: הטקסט נשמר כדוח העבודה של היום. נתונים סינתטיים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const docs = (page, coll) => page.evaluate(c => [...window.__MOCK_STORE__.entries()]
  .filter(([k]) => k.startsWith(c + "/")).map(([, v]) => JSON.parse(JSON.stringify(v))), coll);
const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const status = {
  a1: { id: "a1", code: "04.02", name: "הארקת שולחנות", unit: "מ׳", total: 1000, order: 1, start: "2026-10-01", workDays: 30, group: "הארקות", daily: [] },
  a2: { id: "a2", code: "02.01", name: "חפירת תעלה", unit: "מ׳", total: 500, order: 2, start: "2026-10-01", workDays: 20, group: "תעלות", daily: [] },
};
// מה «Claude» מחזיר על הדיווח
const sample = {
  workers: [
    { name: "עובד בדיקה א", contractor: null, job: "חשמלאי מוסמך", tin: "07:00", tout: "16:30", hours: null, tasks: "הארקה שדה 2" },
    { name: "עובד בדיקה ב", contractor: "קבלן בדיקה ג", job: null, tin: null, tout: null, hours: 8, tasks: null },
  ],
  work: [
    { code: "04.02", name: "הארקה", qty: 300, unit: "מטר", area: "שדה 2", crew: null, workers: 4, note: null },
    { code: null, name: "סידור המחסן", qty: null, unit: null, area: null, crew: null, workers: null, note: null },
  ],
  blockers: [{ kind: "delay", text: "חיכינו למודד שעתיים", area: "חלקה 3", workers: 4, hours: 2 }],
  equipment: [{ type: "מחפרון", model: "JCB", hours: 6 }],
  workText: "בוצעה הארקת שולחנות בשדה 2, 300 מטר.", issuesText: null, weather: "sun",
};

test("דיווח בדיבור עם AI: פענוח, אישור, ושמירה ברשומות הרגילות", async () => {
  const { page, errors } = await openApp(browser, { mock: { seed: { status }, sample } });
  const today = isoOf(new Date());
  await page.waitForFunction(() => shared.STATUS.length === 2);
  await page.click("#fabMic");
  await page.waitForSelector("#dcText");
  assert.strictEqual(await page.textContent("#dcGo"), "פענח ›");
  await page.fill("#dcText", "היום עבדו עובד בדיקה א ועובד בדיקה ב. סיימנו הארקה בשדה 2, 300 מטר. חיכינו למודד שעתיים.");
  await page.click("#dcGo");
  await page.waitForSelector("#dcSave");
  // ההנחיה כוללת את סעיפי הפרויקט ואת הדיווח עצמו
  const call = await page.evaluate(() => window.__MOCK_SAMPLE_CALLS__[0]);
  assert.match(call.input, /04\.02 הארקת שולחנות \[מ׳\]/);
  assert.match(call.input, /חיכינו למודד שעתיים/);
  assert.strictEqual(call.images, 0);
  // רשימת האישור: 2 עובדים, 2 ביצוע (אחד בלי סעיף), חריג, ציוד, טקסט, מזג אוויר
  assert.strictEqual(await page.locator("#dcOut input[data-i]").count(), 8);
  const review = await page.textContent("#dcOut");
  assert.match(review, /עובד: עובד בדיקה א.*07:00–16:30 · 9.5 שעות/s);
  assert.match(review, /דיווח ביצוע: 04\.02 הארקת שולחנות/);
  assert.match(review, /לא זוהה סעיף: סידור המחסן/);
  assert.match(review, /המתנה \/ עיכוב: חיכינו למודד שעתיים/);
  assert.match(review, /מזג אוויר: שמש/);
  // מורידים את הסימון מהציוד, שומרים את השאר
  await page.uncheck('#dcOut input[data-i="5"]');
  await page.click("#dcSave");
  await page.waitForFunction(() => shared.daylog.length === 2 && (shared.blockers || []).length === 1 && (shared.DAYINFO || []).length === 1);
  const W = await docs(page, "daylog");
  const a = W.find(w => w.name === "עובד בדיקה א"), b = W.find(w => w.name === "עובד בדיקה ב");
  assert.deepStrictEqual([a.date, a.tin, a.tout, a.hours, a.job, a.tasks], [today, "07:00", "16:30", 9.5, "חשמלאי מוסמך", "הארקה שדה 2"]);
  assert.deepStrictEqual([b.hours, b.contractor, b.tin], [8, "קבלן בדיקה ג", ""]);
  const s1 = (await docs(page, "status")).find(x => x.id === "a1");
  assert.strictEqual(s1.daily.length, 1);
  assert.deepStrictEqual([s1.daily[0].date, s1.daily[0].actual, s1.daily[0].area, s1.daily[0].workers, s1.daily[0].note], [today, 300, "שדה 2", 4, "הארקה"]);
  assert.strictEqual((await docs(page, "status")).find(x => x.id === "a2").daily.length, 0);
  const bk = (await docs(page, "blockers"))[0];
  assert.deepStrictEqual([bk.kind, bk.text, bk.area, bk.workers, bk.hours, bk.status, bk.date], ["delay", "חיכינו למודד שעתיים", "חלקה 3", 4, 2, "open", today]);
  const di = (await docs(page, "dayinfo"))[0];
  assert.strictEqual(di.id, today);
  assert.strictEqual(di.work, "בוצעה הארקת שולחנות בשדה 2, 300 מטר.\nסידור המחסן");   // הסעיף שלא זוהה נשמר בטקסט
  assert.strictEqual(di.weather, "sun");
  assert.deepStrictEqual(di.equipment || [], []);   // הציוד לא סומן
  assert.deepStrictEqual(errors, []);
  // סיכום בטוסט, החלון נסגר
  assert.match(await page.textContent("body"), /נשמר: 2 עובדים · 1 דיווחי ביצוע · 1 חריגים · טקסט לדוח היומי/);
  assert.strictEqual(await page.locator("#dcText").count(), 0);
  // הדוח היומי מראה את הטקסט ואת דיווח הביצוע
  await page.click("#tabDay");
  await page.click("#btnDayReport");
  await page.waitForSelector("#drFrame");
  const html = await page.getAttribute("#drFrame", "srcdoc");
  assert.match(html, /בוצעה הארקת שולחנות בשדה 2/);
  assert.match(html, /04\.02/);
  assert.match(html, /שמש/);
  await page.close();
});

test("בלי AI: הדיווח נשמר כטקסט של היום", async () => {
  const { page, errors } = await openApp(browser, { mock: { seed: { status } } });
  const today = isoOf(new Date());
  await page.click("#fabMic");
  await page.waitForSelector("#dcText");
  assert.strictEqual(await page.textContent("#dcGo"), "שמור ליום");
  await page.click("#dcGo");   // ריק: לא שומר
  assert.strictEqual((await docs(page, "dayinfo")).length, 0);
  await page.fill("#dcText", "עבדנו בשדה 1 על התעלות");
  await page.click("#dcGo");
  await page.waitForFunction(() => (shared.DAYINFO || []).length === 1);
  const di = (await docs(page, "dayinfo"))[0];
  assert.deepStrictEqual([di.id, di.work], [today, "עבדנו בשדה 1 על התעלות"]);
  assert.strictEqual(await page.evaluate(() => window.__MOCK_SAMPLE_CALLS__ || null), null);
  assert.deepStrictEqual(errors, []);
  await page.close();
});

test("הפענוח במופע ממותג לא מזכיר את חברת הבסיס", async () => {
  // dictPrompt נבנה מהסעיפים והצוות בלבד: אין בו שם חברה או נתוני הסכם
  const { page } = await openApp(browser, { mock: { seed: { status } } });
  const p = await page.evaluate(() => dictPrompt());
  assert.doesNotMatch(p, /S\.E\.E|עין תמר/);
  assert.match(p, /02\.01 חפירת תעלה/);
  await page.close();
});
