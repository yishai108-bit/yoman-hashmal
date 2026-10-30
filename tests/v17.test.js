// גרסה 17: כרטיס האגירה ומטריצת המכולות, סגירת תעלה עם תמונה לכל שכבה ואישור מפקח, ודגל «חשמלאי מוסמך».
// נתונים סינתטיים בלבד.
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
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const lastSheetText = page => page.evaluate(() => { const s = [...document.querySelectorAll(".scrim")].pop(); return s ? s.textContent : ""; });

test("אגירה: בלי סעיפי אגירה הכרטיס מוסתר", async () => {
  const status = { s1: { id: "s1", code: "2.1", name: "הארקה 25", unit: "מ׳", group: "ב · שדה", order: 1, total: 2500, manDays: 48, daily: [] } };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
  await page.waitForFunction(() => shared.STATUS.length === 1);
  assert.strictEqual(await page.evaluate(() => document.querySelector("#bessCard").hidden), true);
  assert.deepStrictEqual(await page.evaluate(() => [containerNums("מכולות 2, 5 ו-7"), containerNums("מכולות 1–4"), containerNums("BESS 12"), containerNums("שדה 3 · 12 מ׳")]),
    [[2, 5, 7], [1, 2, 3, 4], [12], []]);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("אגירה: סיכום הפרק, מטריצת מכולות מדיווחי הביצוע, לחיצה על תא פותחת דיווח מוכן", async () => {
  const T = today();
  const status = {
    s1: { id: "s1", code: "8.1.2", name: "מכולות ממירים ואגירה", unit: "קומפ׳", group: "ח · אגירה: תשתית", order: 60, total: 14, manDays: 32,
      daily: [{ id: "d1", date: T, actual: 3, area: "מכולות 1–3", crew: "צוות א", workers: 2, ts: 1 }, { id: "d2", date: T, actual: 1, area: "מתחם אגירה", crew: "צוות א", workers: 1, ts: 2 }] },
    s2: { id: "s2", code: "8.5.5", name: "שרשור סוללות במכולות", unit: "יח׳", group: "ח · אגירה: בדיקות", order: 90, total: 14, manDays: 10, daily: [] },
    s3: { id: "s3", code: "8.2.2", name: "כבלי מ״ג 3x1x300", unit: "מ׳", group: "ח · אגירה: כבלי מ״ג", order: 69, total: 80, manDays: 12, daily: [] },
    s4: { id: "s4", code: "2.1", name: "הארקה 25", unit: "מ׳", group: "ב · שדה", order: 1, total: 2500, manDays: 48, daily: [] },
  };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
  await page.waitForFunction(() => shared.STATUS.length === 4 && !document.querySelector("#bessCard").hidden);
  assert.strictEqual(await page.locator("table.bess thead th").count(), 3, "מכולה + שני סעיפים שנספרים לפי מכולה (הכבל במטרים לא)");
  assert.strictEqual(await page.locator("table.bess tbody tr").count(), 14);
  assert.strictEqual(await page.locator("table.bess .cell.on").count(), 3, "«מכולות 1–3» צובע שלושה תאים");
  assert.match(await page.textContent("#sum_bess"), /0\/14 מכולות/);
  assert.match(await page.textContent(".bess-unp"), /1 דיווחים ב-8\.1\.2 בלי מספר מכולה/);
  assert.strictEqual(await page.locator(".bess-subs div").count(), 3, "שלושה תתי-פרק");
  // תא ריק: דיווח מוכן על הסעיף והמכולה
  await page.click('table.bess .cell[data-n="5"][data-a="s2"]');
  assert.strictEqual(await page.inputValue("#prArea"), "מכולה 5");
  assert.strictEqual(await page.inputValue("#prQty"), "1");
  await page.fill("#prWorkers", "2"); await page.click("#prSave");
  await page.waitForSelector('table.bess .cell.on[data-n="5"][data-a="s2"]');
  const s2 = (await docs(page, "status")).find(a => a.id === "s2");
  assert.strictEqual(s2.daily.length, 1); assert.strictEqual(s2.daily[0].area, "מכולה 5"); assert.strictEqual(s2.daily[0].actual, 1);
  // תא מסומן: הדיווח עצמו
  await page.click('table.bess .cell.on[data-n="2"][data-a="s1"]');
  assert.strictEqual(await page.inputValue("#prArea"), "מכולות 1–3");
  assert.strictEqual(await page.inputValue("#prQty"), "3");
  await page.evaluate(() => document.querySelectorAll(".scrim").forEach(s => s.remove()));   // בעריכה יש גם כפתור מחיקה עם .cancel
  // «בלי מספר מכולה» פותח את רשימת הדיווחים של הסעיף
  await page.click(".bess-unp [data-unp]");
  assert.match(await lastSheetText(page), /מתחם אגירה/);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("סגירת תעלה: תמונה לכל שכבה, ממתין ואז אושר ע״י מפקח, בסיכום היומי", async () => {
  const T = today();
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  assert.match(await page.textContent("#tcList"), /אין עדיין סגירות תעלה/);
  await page.click("#btnTrench");
  await page.fill("#tcTrench", "תעלה B1"); await page.fill("#tcSeg", "שוחה 3 עד 4"); await page.fill("#tcMeters", "120");
  assert.strictEqual(await page.inputValue("#tcDate"), T);
  assert.strictEqual(await page.textContent("#tcLayN"), "0 / 4");
  await page.setInputFiles("#tcP_cables", { name: "a.png", mimeType: "image/png", buffer: PNG });
  await page.setInputFiles("#tcP_sand", { name: "b.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => document.querySelector("#tcLayN").textContent === "2 / 4");
  assert.ok(await page.evaluate(() => document.querySelector("#tcApprF").hidden), "שדות המפקח מוסתרים כל עוד ממתין");
  await page.click("#tcSave");
  await page.waitForFunction(() => (shared.TRENCH || []).length === 1);
  let d = (await docs(page, "trenchclose"))[0];
  assert.deepStrictEqual(Object.keys(d.layers).sort(), ["cables", "sand"], "רק שכבות עם תמונה נשמרות");
  assert.ok(d.layers.cables.photoData.startsWith("data:image/jpeg"), "בלי מאגר קבצים התמונה נשמרת מוקטנת");
  assert.strictEqual(d.meters, 120); assert.strictEqual(d.approved, false); assert.strictEqual(d.trench, "תעלה B1");
  assert.strictEqual(await page.locator("#tcList .slip.tc").count(), 1);
  assert.strictEqual(await page.locator("#tcList .slip.tc.ok").count(), 0);
  assert.match(await page.textContent("#tcList"), /2\/4 שכבות מצולמות · ממתין לאישור מפקח/);
  assert.match(await page.textContent("#sum_tc"), /1 ממתינים לאישור/);
  // אישור: בלי שם מפקח לא נשמר
  await page.click("#tcList .slip.tc");
  assert.strictEqual(await page.textContent("#tcLayN"), "2 / 4", "התמונות הקיימות נספרות");
  await page.click('#tcAppr [data-v="1"]');
  assert.ok(!(await page.evaluate(() => document.querySelector("#tcApprF").hidden)));
  assert.strictEqual(await page.inputValue("#tcApprDate"), T);
  await page.click("#tcSave");
  await page.waitForTimeout(150);
  assert.strictEqual((await docs(page, "trenchclose"))[0].approved, false, "«מי אישר?» חוסם");
  await page.fill("#tcInsp", "מפקח א");
  await page.setInputFiles("#tcP_tape", { name: "c.png", mimeType: "image/png", buffer: PNG });
  await page.click("#tcSave");
  await page.waitForFunction(() => shared.TRENCH[0].approved === true);
  d = (await docs(page, "trenchclose"))[0];
  assert.strictEqual(d.inspector, "מפקח א"); assert.strictEqual(d.approvedAt, T);
  assert.deepStrictEqual(Object.keys(d.layers).sort(), ["cables", "sand", "tape"]);
  assert.strictEqual(await page.locator("#tcList .slip.tc.ok").count(), 1);
  assert.match(await page.textContent("#tcList"), /3\/4 שכבות מצולמות · אושר ע״י מפקח א/);
  assert.match(await page.textContent("#sum_tc"), /1 אושרו/);
  // הסיכום היומי
  const lines = await page.evaluate(t => trenchLines(t), T);
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /^סגירת תעלה: תעלה B1 · שוחה 3 עד 4 120 מ׳, 3\/4 שכבות מצולמות, אושר ע״י מפקח א/);
  await page.evaluate(() => openWa());
  assert.match(await page.inputValue("#waText"), /סגירת תעלה: תעלה B1/);
  // החשבון החלקי: טבלת הסגירות, התמונות, ושורה ב-CSV של הגיבוי
  const bill = await page.evaluate(t => billHtml(billData(t, t), {}), T);
  assert.match(bill, /<h3>סגירות תעלה בתקופה<\/h3>/); assert.match(bill, /תעלה B1 · שוחה 3 עד 4/); assert.match(bill, /✓ כבילה הונחה<br>✓ חול \/ ריפוד<br>✓ סרט סימון<br>· כיסוי \/ הגנה/);
  assert.match(bill, /אושר ע״י מפקח א/); assert.strictEqual((bill.match(/<figure>/g) || []).length, 3, "שלוש תמונות שכבה");
  const csv = await page.evaluate(t => billBackupCsv(billData(t, t)), T);
  assert.match(csv, /סגירת תעלה.*תעלה B1 · שוחה 3 עד 4.*3\/4 שכבות מצולמות/);
  assert.ok(!(await page.evaluate(t => billData(t, t).flags.join(" "), T)).includes("ממתינות לאישור"), "אחרי האישור אין דגל");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("חשמלאי מוסמך: דגל נפרד מהתפקיד, מהצוות הקבוע לרישום היומי, בסיכום ובדוח היומי", async () => {
  const T = today();
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openWorker());
  await page.fill("#wkName", "דני");
  assert.strictEqual(await page.getAttribute('#wkCert [data-v="1"]', "aria-pressed"), "false");
  await page.fill("#wkJob", "חשמלאי מוסמך");
  assert.strictEqual(await page.getAttribute('#wkCert [data-v="1"]', "aria-pressed"), "true", "תפקיד «חשמלאי מוסמך» מסמן את הדגל לבד");
  await page.fill("#wkHours", "9");
  await page.click("#wkSave");
  await page.waitForFunction(() => (shared.daylog || []).length === 1);
  let rows = await docs(page, "daylog");
  assert.strictEqual(rows[0].cert, true);
  assert.match(await page.textContent("#dyList"), /⚡ מוסמך/);
  assert.match(await page.textContent("#dySub"), /1 חשמלאים מוסמכים/);
  // צוות קבוע: דגל מפורש, בלי קשר לתפקיד
  await page.evaluate(() => openCrewForm());
  await page.fill("#cwName", "רון"); await page.fill("#cwJob", "עוזר חשמלאי");
  assert.strictEqual(await page.getAttribute('#cwCert [data-v="1"]', "aria-pressed"), "false");
  await page.click('#cwCert [data-v="1"]');
  await page.click("#cwSave");
  await page.waitForFunction(() => (shared.CREW || []).length === 1);
  assert.strictEqual((await docs(page, "crew"))[0].cert, true);
  // רישום יומי מהצוות: הדגל מגיע מהצוות; אחרי שנגעו בכפתור, התפקיד כבר לא משנה אותו
  await page.evaluate(() => openWorker());
  await page.fill("#wkName", "רון"); await page.dispatchEvent("#wkName", "change");
  assert.strictEqual(await page.inputValue("#wkJob"), "עוזר חשמלאי");
  assert.strictEqual(await page.getAttribute('#wkCert [data-v="1"]', "aria-pressed"), "true");
  await page.click('#wkCert [data-v="0"]');
  await page.fill("#wkJob", "חשמלאי מוסמך");
  assert.strictEqual(await page.getAttribute('#wkCert [data-v="1"]', "aria-pressed"), "false", "נגעו בכפתור: התפקיד לא דורס");
  await page.click("#wkSave");
  await page.waitForFunction(() => shared.daylog.length === 2);
  rows = await docs(page, "daylog");
  assert.deepStrictEqual(rows.map(w => [w.name, w.cert]).sort(), [["דני", true], ["רון", false]]);
  // סיכום לוואטסאפ ודוח יומי
  await page.evaluate(() => openWa());
  assert.match(await page.inputValue("#waText"), /חשמלאים מוסמכים: 1/);
  await page.evaluate(() => document.querySelectorAll(".scrim").forEach(s => s.remove()));
  await page.evaluate(t => openDailyReport(t), T);
  const rep = await page.getAttribute("#drFrame", "srcdoc");
  assert.match(rep, /1 חשמלאים מוסמכים/);
  assert.match(rep, /חשמלאי מוסמך <small>· מוסמך<\/small>/);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
