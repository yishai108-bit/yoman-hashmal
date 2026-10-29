// דוח יומי (גרסה 6): שעת כניסה/יציאה לעובד עם סה״כ אוטומטי, פרטי היום (מזג אוויר, מנהל עבודה, מזמין, ציוד),
// חתימה באצבע, והמסמך בפריסת טופס הנייר. נתונים סינתטיים בלבד.
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

test("דוח יומי: שעות כניסה/יציאה, פרטי היום, חתימה, ומסמך כמו הטופס", async () => {
  const { page, errors } = await openApp(browser, { mock: { seed: fixture } });
  const today = isoOf(new Date());
  await page.click("#tabDay");
  // עובד עם שעת כניסה ויציאה: סה״כ השעות מחושב לבד
  await page.evaluate(() => openWorker());
  await page.fill("#wkName", "עובד בדיקה א"); await page.fill("#wkJob", "חשמלאי מוסמך");
  await page.fill("#wkIn", "07:00"); await page.fill("#wkOut", "16:30"); await page.dispatchEvent("#wkOut", "change");
  assert.strictEqual(await page.inputValue("#wkHours"), "9.5");
  await page.click("#wkSave");
  await page.waitForFunction(() => shared.daylog.some(w => w.name === "עובד בדיקה א"));
  // עובד של קבלן משנה: מוסיף חתימת ראש צוות לרשימת החתימות
  await page.evaluate(() => openWorker());
  await page.fill("#wkName", "עובד בדיקה ב"); await page.fill("#wkCon", "קבלן בדיקה ג");
  await page.fill("#wkIn", "07:30"); await page.fill("#wkOut", "15:30"); await page.dispatchEvent("#wkOut", "change");
  await page.click("#wkSave");
  await page.waitForFunction(() => shared.daylog.filter(w => w.name.startsWith("עובד בדיקה")).length === 2);
  const w = (await docs(page, "daylog")).find(x => x.name === "עובד בדיקה א");
  assert.deepStrictEqual([w.tin, w.tout, w.hours], ["07:00", "16:30", 9.5]);
  assert.match(await page.textContent("#dyList"), /07:00–16:30/);
  // פרטי היום
  await page.click("#btnDayInfo");
  await page.click('#diWeather [data-v="partly"]');
  await page.fill("#diForeman", "מנהל בדיקה"); await page.fill("#diClient", "מזמין בדיקה");
  await page.fill("#diWork", "נמשכו כבלים בשדה 1");
  await page.click("#diEqAdd");
  await page.fill('#diEq input[data-k="type"]', "מחפרון"); await page.fill('#diEq input[data-k="model"]', "JCB 3CX"); await page.fill('#diEq input[data-k="hours"]', "6");
  await page.click("#diSave");
  await page.waitForFunction(() => (shared.DAYINFO || []).length === 1);
  const di = (await docs(page, "dayinfo"))[0];
  assert.deepStrictEqual([di.id, di.no, di.weather, di.foreman, di.client, di.work, di.equipment],
    [today, "1", "partly", "מנהל בדיקה", "מזמין בדיקה", "נמשכו כבלים בשדה 1", [{ type: "מחפרון", model: "JCB 3CX", hours: 6, note: "" }]]);
  assert.match(await page.textContent("#dyReport"), /דוח מס׳ 1 · מעונן חלקית · מנהל עבודה: מנהל בדיקה/);
  // חתימות: שלוש קבועות + ראש צוות לכל קבלן משנה שעבד היום
  const nSub = await page.evaluate(() => new Set(dayRows(shared.dayISO).map(w => (w.contractor || "").trim()).filter(Boolean)).size);
  await page.click("#btnDaySigs");
  assert.strictEqual(await page.locator("#sgList .slip").count(), 3 + nSub);
  assert.match(await page.textContent("#sgList"), /ראש צוות · קבלן בדיקה ג/);
  await page.locator("#sgList .slip").nth(2).click();   // מנהל עבודה
  await page.fill("#sgName", "מנהל בדיקה");
  const box = await page.locator("#sgPad canvas").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 60); await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 90, { steps: 8 }); await page.mouse.move(box.x + 200, box.y + 50, { steps: 8 }); await page.mouse.up();
  await page.click("#sgSave");
  await page.waitForFunction(() => { const d = (shared.DAYINFO || [])[0]; return !!(d && d.sigs && d.sigs.foreman && d.sigs.foreman.data); });
  assert.match(await page.textContent("#sgList"), /מנהל בדיקה/);
  assert.match(await page.textContent("#dyReport"), new RegExp("חתימות: 1/" + (3 + nSub)));
  await page.click("[aria-label='חתימות'] .cancel");
  // המסמך: כותרת כמו הטופס, שתי רשימות עובדים, חומרים, ציוד, דוח עבודה, ליקויים, חתימות
  await page.click("#btnDayReport");
  const html = await page.getAttribute("#drFrame", "srcdoc");
  for (const s of ["דוח יומי", "רשימת העובדים", "עובד בדיקה א", "07:00", "16:30", "9.5", "קבלן משנה · קבלן בדיקה ג", "חומרים / אספקות", "ציוד וכלים", "מחפרון", "JCB 3CX",
    "דוח עבודה יומי", "נמשכו כבלים בשדה 1", "ליקויים / בעיות / בטיחות", "חתימת מנהל עבודה", "חתימת ראש צוות · קבלן בדיקה ג", "מעונן חלקית", "מס׳ דוח", '<img src="data:image/png'])
    assert.ok(html.includes(s), "חסר במסמך: " + s);
  assert.ok(!/₪|מחיר/.test(html), "בלי מחירים");
  await page.click("#drDl");
  await page.waitForFunction(() => window.__MOCK_SAVED__.length >= 1);
  const saved = await page.evaluate(() => window.__MOCK_SAVED__.map(f => f.filename));
  assert.ok(saved.some(n => n.startsWith("דוח-יומי-") && n.endsWith(".html")), saved.join(","));
  assert.deepStrictEqual(errors, []);
});
