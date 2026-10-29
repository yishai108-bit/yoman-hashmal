// גרסה 4, הכסף של קבלן המשנה: חשבון חלקי לתקופה (מצטבר קודם / בתקופה / מצטבר לפי סעיף, נספח גיבוי, עבודות נוספות,
// עיכובים שאינם באחריותנו, ימי עובד מול ההסכם, חומר שסופק), תמונה בדיווח ביצוע, «שורף ימי עובד». נתונים סינתטיים בלבד, בלי מחירים.
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
const ts = iso => new Date(iso + "T12:00:00").getTime();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("חשבון חלקי: מצטבר קודם / בתקופה / מצטבר לפי סעיף, נספח גיבוי, עבודות נוספות ועיכובים, ימי עובד שאבדו, CSV, ובלי חריגים רגילים", async () => {
  const status = {
    s1: { id: "s1", code: "2.1", name: "הארקה 25", unit: "מ׳", group: "ב · שדה", order: 1, total: 2500, manDays: 48, daily: [
      { id: "w1", date: "2026-09-28", actual: 300, area: "שדה 1", crew: "צוות א", workers: 2, ts: 1 },
      { id: "w2", date: "2026-10-05", actual: 500, area: "שדה 1", crew: "צוות א", workers: 3, ts: 2 },
      { id: "w3", date: "2026-10-12", actual: 200, area: "שדה 2", crew: "צוות ב", workers: 2, ts: 3, photoData: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" }] },
    s2: { id: "s2", code: "2.6", name: "מאריכי סטרינג", unit: "מ׳", group: "ב · שדה", order: 2, total: 45000, manDays: 100, daily: [
      { id: "w4", date: "2026-10-20", actual: 1000, area: "שדה 3", crew: "צוות ג", workers: 40, ts: 4 }] },        // 40% מימי העובד מול 2% ביצוע: שורף
    s3: { id: "s3", code: "9.1", name: "חשמל זמני", unit: "קומפ׳", group: "ט · חשמל זמני", order: 3, total: 1, manDays: 10, daily: [] },
  };
  const blockers = {
    e1: { id: "e1", kind: "extra", date: "2026-10-08", ts: ts("2026-10-08"), text: "שינוי תוואי תעלה", area: "שדה 1", instructedBy: "pm", written: false, qty: "120 מ׳", workers: 3, hours: 4, status: "open" },
    d1: { id: "d1", kind: "delay", date: "2026-10-09", ts: ts("2026-10-09"), text: "חיכינו לקונסטרוקציה", area: "שדה 3", cause: "constr", workers: 4, hours: 4, status: "open" },
    b1: { id: "b1", kind: "material", date: today(), ts: Date.now(), text: "חסר מהדקים", area: "שדה 1", status: "open" },
    o1: { id: "o1", kind: "delay", date: "2026-09-15", ts: ts("2026-09-15"), text: "עיכוב מחודש שעבר", cause: "site", workers: 2, status: "open" },
  };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status, blockers } } });
  const D = await page.evaluate(() => { const D = billData("2026-10-01", "2026-10-31", {}); return JSON.parse(JSON.stringify({
    shown: D.shown.map(a => [a.code, a.before, a.period, a.cum, a.manPeriod, a.manCum, a.burn, a.photos]), extras: D.extras.map(b => b.id), delays: D.delays.map(b => b.id),
    lost: D.lost, extraMan: D.extraMan, groups: D.groups.map(g => g.name), all: billData("2026-10-01", "2026-10-31", { all: true }).shown.length })); });
  assert.deepStrictEqual(D.shown, [["2.1", 300, 700, 1000, 5, 7, false, 1], ["2.6", 0, 1000, 1000, 40, 40, true, 0]]);
  assert.deepStrictEqual([D.extras, D.delays, D.lost, D.extraMan, D.groups, D.all], [["e1"], ["d1"], 2, 1.5, ["ב · שדה"], 3]);
  const html = await page.evaluate(() => billHtml(billData("2026-10-01", "2026-10-31", { no: "3" })));
  for (const s of ["חשבון חלקי", "מס׳", "2.1", "הארקה 25", "מצטבר קודם", "שינוי תוואי תעלה", "החברה המנהלת / המפקח", "בעל פה", "חיכינו לקונסטרוקציה", "קונסטרוקציה", "data:image/gif", "כמויות בלבד", "ימי עובד לפי סעיף", "⚠", "נספח"])
    assert.ok(html.includes(s), "חסר ב-HTML: " + s);
  for (const s of ["חסר מהדקים", "עיכוב מחודש שעבר", "₪"]) assert.ok(!html.includes(s), "לא אמור להיות ב-HTML: " + s);
  const csv = await page.evaluate(() => billCsv(billData("2026-10-01", "2026-10-31", {})));
  assert.match(csv, /"ב · שדה","2\.1","הארקה 25","מ׳","2500","300","700","1000","40","48","5","7"/);
  assert.match(csv, /"9\.1","חשמל זמני"/);                                                         // ב-CSV כל הסעיפים
  const bk = await page.evaluate(() => billBackupCsv(billData("2026-10-01", "2026-10-31", {})));
  assert.match(bk, /"דיווח ביצוע","2\.1","הארקה 25","05\.10\.2026","500"/); assert.match(bk, /"עבודה נוספת"/); assert.match(bk, /"עיכוב",.*"2","ימי עובד"/);
  // החלון: תקופה, תצוגה, וכפתורים
  await page.evaluate(() => openBill());
  await page.fill("#blStart", "2026-10-01"); await page.fill("#blEnd", "2026-10-31");
  await page.waitForFunction(() => (document.querySelector("#blFrame").srcdoc || "").includes("הארקה 25"));
  for (const id of ["#blDl", "#blPrint", "#blCsv", "#blCsv2"]) assert.ok(await page.isVisible(id), id);
  await page.click(".scrim:last-of-type .cancel");
  // דף הביצוע: סעיף ששורף ימי עובד מסומן; חריגים: מה שתוקע לחוד, מה שלחשבון לחוד; ההתרעה סופרת רק מה שתוקע
  assert.match(await page.textContent("#statusList"), /שורף: 40% מימי העובד מול 2% ביצוע/);
  const blk = await page.textContent("#blkList");
  assert.match(blk, /חסר מהדקים/); assert.match(blk, /לחשבון: עבודות נוספות ועיכובים/); assert.match(blk, /2 ימי עובד/); assert.match(blk, /1\.5 ימי עובד/);
  assert.match(await page.textContent("#sum_blk"), /^1 פתוחים · 3 לחשבון$/);
  assert.ok(await page.evaluate(() => document.querySelector("#ovAlerts").hidden || !document.querySelector("#ovAlerts").textContent.includes("חריגים פתוחים יותר משלושה ימים")));
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("דיווח ביצוע עם תמונה, עבודה נוספת עם מי הורה, ועיכוב: נשמרים, בסיכום היומי ובדוח השבועי", async () => {
  const T = today();
  const status = { s1: { id: "s1", code: "2.1", name: "הארקה 25", unit: "מ׳", group: "ב · שדה", order: 1, total: 2500, manDays: 48, daily: [] } };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { ...fixture, status } } });
  await page.evaluate(() => openWorkReport({ activityId: "s1" }));
  await page.fill("#prQty", "120"); await page.fill("#prArea", "שדה 1"); await page.fill("#prWorkers", "2");
  await page.setInputFiles("#prPhoto", { name: "a.png", mimeType: "image/png", buffer: PNG });
  await page.click("#prSave");
  await page.waitForFunction(() => (shared.STATUS[0].daily || []).length === 1);
  const d = (await docs(page, "status"))[0].daily[0];
  assert.ok(d.photoData && d.photoData.startsWith("data:image/jpeg"), "בלי מאגר קבצים התמונה נשמרת מוקטנת ברשומה");
  assert.strictEqual(d.workers, 2);
  assert.match(await page.textContent("#dyWork"), /📷/);
  // עריכה: התמונה נשארת
  await page.evaluate(() => openWorkReport({ activityId: "s1", entry: shared.STATUS[0].daily[0] }));
  assert.ok(await page.isVisible("#prPhotoBox .pthumb"));
  await page.fill("#prQty", "130"); await page.click("#prSave");
  await page.waitForFunction(() => shared.STATUS[0].daily[0].actual === 130);
  assert.ok((await docs(page, "status"))[0].daily[0].photoData.startsWith("data:image/jpeg"));
  // עבודה נוספת
  await page.evaluate(() => openBlocker());
  assert.ok(await page.isHidden("#bkClaim"));
  await page.click('#bkKind [data-k="extra"]');
  assert.ok(await page.isVisible("#bkClaim")); assert.ok(await page.isVisible("#bkWhoF")); assert.ok(await page.isHidden("#bkCauseF"));
  assert.strictEqual(await page.textContent("#bkTextLab"), "מה נעשה / מה השתנה");
  await page.fill("#bkText", "שינוי תוואי תעלה"); await page.fill("#bkArea", "שדה 1");
  await page.click('#bkWho [data-k="pm"]'); await page.click('#bkWritten [data-k="0"]');
  await page.fill("#bkWorkers", "3"); await page.fill("#bkHours", "4"); await page.fill("#bkQty", "120 מ׳");
  assert.match(await page.textContent("#bkMan"), /ימי עובד שהושקעו: 1\.5/);
  await page.click("#bkSave");
  await page.waitForFunction(() => (shared.blockers || []).length === 1);
  const b = (await docs(page, "blockers"))[0];
  assert.deepStrictEqual([b.kind, b.instructedBy, b.written, b.workers, b.hours, b.qty, b.area, b.status], ["extra", "pm", false, 3, 4, "120 מ׳", "שדה 1", "open"]);
  // עיכוב
  await page.evaluate(() => openBlocker());
  await page.click('#bkKind [data-k="delay"]');
  assert.ok(await page.isVisible("#bkCauseF")); assert.ok(await page.isHidden("#bkWhoF"));
  await page.fill("#bkText", "חיכינו לקונסטרוקציה"); await page.click('#bkCause [data-k="constr"]'); await page.fill("#bkWorkers", "4"); await page.fill("#bkHours", "4");
  await page.click("#bkSave");
  await page.waitForFunction(() => (shared.blockers || []).length === 2);
  const txt = await page.evaluate(t => dailySummaryText(t), T);
  assert.match(txt, /עבודות נוספות: שינוי תוואי תעלה \(120 מ׳\) · הורה: החברה המנהלת \/ המפקח/);
  assert.match(txt, /צוות עמד: 4 עובדים × 4 שעות, חיכינו לקונסטרוקציה \(קונסטרוקציה\) · ימי עובד שאבדו: 2/);
  assert.match(txt, /תקוע: אין/);
  assert.match(await page.textContent("#sum_blk"), /^2 לחשבון$/);
  // סימון «הוגש»
  await page.evaluate(() => openBlocker(shared.blockers.find(x => x.kind === "extra")));
  assert.strictEqual(await page.textContent('#bkSt [data-v="closed"]'), "הוגש / סוכם");
  await page.click('#bkSt [data-v="closed"]'); await page.fill("#bkClose", "הוגש בחשבון 3"); await page.click("#bkSave");
  await page.waitForFunction(() => (shared.blockers || []).find(x => x.kind === "extra").status === "closed");
  assert.match(await page.textContent("#blkList"), /הוגש/);
  // הדוח השבועי למנהלים: הסעיף החדש ו-ימי עובד שאבדו
  const r = await page.evaluate(t => { const D = wrData(t); return { mgr: wrHtml("mgr", D, {}), client: wrHtml("client", D, {}), txt: wrText("mgr", D, {}), lost: D.lostW, n: D.claimsW.length }; }, T);
  assert.deepStrictEqual([r.n, r.lost], [2, 2]);
  assert.ok(r.mgr.includes("עבודות נוספות ועיכובים השבוע") && r.mgr.includes("חיכינו לקונסטרוקציה"));
  assert.ok(!r.client.includes("חיכינו לקונסטרוקציה"));
  assert.match(r.txt, /עבודות נוספות \/ עיכובים השבוע: 2 · 2 ימי עובד אבדו/);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
