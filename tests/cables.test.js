// כבלים: מילון כינויים, תוף מתעודת משלוח, קליטת תוף, 3 משיכות, סגירה עם שארית, מאזן לפי סוג.
// נתונים סינתטיים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const docs = (page, coll) => page.evaluate(c => [...window.__MOCK_STORE__.entries()]
  .filter(([k]) => k.startsWith(c + "/")).map(([, v]) => JSON.parse(JSON.stringify(v))), coll);

const cableTypes = { ts: 1, types: [
  { code: "DC6-BK", desc: "כבל סולארי 6 שחור", boqCode: "1.1", aliases: ["סטרינג 6 שחור", "סולארי שחור"] },
  { code: "PE25", desc: "הארקה נחושת 25", boqCode: "2.1", aliases: ["הארקה 25", "PE 25"] },
] };
const boq = { source: "בדיקה", lines: [{ code: "1.1", name: "כבל סולארי 6 שחור", qty: 3000, unit: "מ'" }] };

test("מילון: קיצור בעל פה מתורגם לסוג, הכינוי הארוך מנצח", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: { settings: { cableTypes } } } });
  const r = await page.evaluate(() => ["סטרינג 6 שחור", "תוף הארקה 25 1000 מ'", "PE25", "כבל לא מוכר"].map(cableTypeOf));
  assert.deepStrictEqual(r, ["DC6-BK", "PE25", "PE25", ""]);
  await ctx.close();
});

test("תעודת משלוח עם שורת «תוף» יוצרת רשומות תוף", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { settings: { cableTypes } } } });
  const unit = await page.evaluate(() => drumsFromNote({ id: "n1", supplier: "ספק א", ts: 1, lines: [
    { name: "כבל סולארי שחור", qty: 1000, unit: "מ'", drumNo: "1001" },
    { name: "הארקה 25", qty: 2, unit: "תוף", meters: 500 },
    { name: "מחבר MC4 זוג", qty: 50, unit: "יח'" } ] }).map(d => [d.drumNo, d.cableType, d.lengthIn]));
  assert.deepStrictEqual(unit, [["1001", "DC6-BK", 1000], ["", "PE25", 500], ["", "PE25", 500]]);
  // דרך הטופס: שורה «תוף סטרינג 6 שחור 1000 מ'» × 2 → שני תופים, וחלון השלמה למספרי התופים
  await page.evaluate(() => openNote());
  await page.fill("#iSup", "ספק א"); await page.fill("#iNo", "3001");
  await page.click("#bAddLine");
  const row = page.locator("#dl .dline").last();
  await row.locator('input[aria-label="שם פריט"]').fill("תוף סטרינג 6 שחור 1000 מ'");
  await row.locator('input[aria-label="כמות"]').fill("2");
  await page.click("#bSaveNote");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.keys()].filter(k => k.startsWith("drums/")).length === 2);
  const dr = await docs(page, "drums");
  assert.deepStrictEqual(dr.map(d => [d.cableType, d.lengthIn, d.status]), [["DC6-BK", 1000, "full"], ["DC6-BK", 1000, "full"]]);
  await page.waitForSelector("text=תופים מהתעודה");
  const nos = page.locator('#drRows input[data-k="drumNo"]');
  await nos.nth(0).fill("2001"); await nos.nth(1).fill("2002");
  await page.click("#drSave");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.values()].filter(v => v && v.drumNo === "2002").length === 1);
  assert.deepStrictEqual((await docs(page, "drums")).map(d => d.drumNo).sort(), ["2001", "2002"]);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("תוף: קליטה, 3 משיכות, סגירה עם שארית, ומאזן לפי סוג", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { settings: { cableTypes, boq } } } });
  // קליטה ידנית, עם כינוי
  await page.evaluate(() => openDrumIntake());
  await page.fill('#drRows input[data-k="drumNo"]', "1001");
  await page.fill('#drRows input[data-k="alias"]', "סטרינג 6 שחור");
  await page.fill('#drRows input[data-k="lengthIn"]', "1000");
  await page.fill('#drRows input[data-k="location"]', "חצר");
  await page.click("#drSave");
  await page.waitForFunction(() => (shared.drums || []).some(d => d.drumNo === "1001"));   // האפליקציה קיבלה את התוף מהמאגר, לא רק המאגר
  const [drum] = await docs(page, "drums");
  assert.deepStrictEqual([drum.drumNo, drum.cableType, drum.lengthIn, drum.status], ["1001", "DC6-BK", 1000, "full"]);
  // שלוש משיכות
  for (const [i, [m, area]] of [[300, "שדה 1 · סטרינג 3"], [250, "שדה 1 · סטרינג 4"], [380, "שדה 2"]].entries()) {
    await page.evaluate(id => openPull(id), drum.id);
    await page.fill("#plM", String(m));
    await page.fill("#plArea", area);
    await page.fill("#plCrew", "צוות 1");
    await page.click("#plSave");
    await page.waitForFunction(n => [...window.__MOCK_STORE__.keys()].filter(k => k.startsWith("pulls/")).length === n, i + 1);
    await page.waitForTimeout(20);
  }
  const pulls = await docs(page, "pulls");
  assert.deepStrictEqual(pulls.map(p => p.meters).sort((a, b) => a - b), [250, 300, 380]);
  assert.strictEqual(await page.evaluate(id => drumRemain(shared.drums.find(d => d.id === id)), drum.id), 70);
  assert.strictEqual((await docs(page, "drums"))[0].status, "inUse");
  let bal = await page.evaluate(() => cableBalance().find(e => e.code === "DC6-BK"));
  assert.deepStrictEqual([bal.planned, bal.arrived, bal.pulled, bal.stock, bal.left], [3000, 1000, 930, 70, 2070]);
  // סגירה: 70 מ׳ = 7%, מעל סף 5%
  await page.evaluate(id => openCloseDrum(id), drum.id);
  assert.match(await page.textContent(".scrim:last-of-type"), /70 מ׳ · 7%/);
  assert.match(await page.textContent(".scrim:last-of-type"), /משיכות שלא נרשמו/);
  await page.click("#cdSave");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.values()].some(v => v && v.drumNo === "1001" && v.status === "empty"));
  await page.waitForFunction(() => shared.drums.some(d => d.drumNo === "1001" && d.status === "empty"));
  const closed = (await docs(page, "drums"))[0];
  assert.strictEqual(closed.remainderAtClose, 70);
  bal = await page.evaluate(() => cableBalance().find(e => e.code === "DC6-BK"));
  assert.deepStrictEqual([bal.stock, bal.unexplained, bal.open], [0, 70, 0]);
  // הלשונית
  await page.click("#tabCables");
  assert.strictEqual(await page.textContent("#cbBig"), "0");
  assert.match(await page.textContent("#cbList"), /כבל סולארי 6 שחור/);
  assert.match(await page.textContent("#cbDrums"), /תוף 1001.*ריק/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
