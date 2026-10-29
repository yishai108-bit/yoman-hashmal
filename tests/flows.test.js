// זרימות מלאות מול המאגר המדומה: קליטת תעודה, ניפוק חומרים, ספירה מהירה.
// כל בדיקה ממלאת את הטופס כמו משתמש, שומרת, ובודקת מה נכתב למאגר ומה המלאי מראה אחרי.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const byName = rows => Object.fromEntries(rows.map(r => [r.name, r]));
const docs = (page, coll) => page.evaluate(c => [...window.__MOCK_STORE__.entries()]
  .filter(([k]) => k.startsWith(c + "/")).map(([, v]) => JSON.parse(JSON.stringify(v))), coll);

test("קליטת תעודה ידנית: נשמרת עם התאריך מהתעודה, נכנסת למלאי, זיכוי נשמר כשלילי", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openNote());
  await page.fill("#iSup", "ספק ב");
  await page.fill("#iNo", "2001");
  await page.fill("#iDate", "07/10/2026");
  for (const [name, qty] of [["בורג M8", "40"], ["כבל סולארי 6", "-10"]]) {
    await page.click("#bAddLine");
    const row = page.locator("#dl .dline").last();
    await row.locator('input[aria-label="שם פריט"]').fill(name);
    await row.locator('input[aria-label="כמות"]').fill(qty);
  }
  assert.strictEqual(await page.isDisabled("#bSaveNote"), false);
  await page.click("#bSaveNote");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.keys()].filter(k => k.startsWith("deliveries/")).length === 3);
  const d = (await docs(page, "deliveries")).find(x => x.noteNo === "2001");
  assert.strictEqual(d.supplier, "ספק ב");
  assert.strictEqual(new Date(d.ts).getDate(), 7);              // התאריך מהתעודה ולא מהיום
  assert.deepStrictEqual(d.lines.map(l => [l.name, l.qty]), [["בורג M8", 40], ["כבל סולארי 6", -10]]);
  await page.waitForTimeout(100);
  const r = byName(await page.evaluate(() => stockRows()));
  assert.strictEqual(r["בורג M8"].in, 190);                      // 150 + 40
  assert.strictEqual(r["כבל סולארי 6"].in, 470);                 // 480 − 10
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("קליטת תעודה: בלי שורה עם כמות אי אפשר לשמור", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openNote());
  await page.click("#bAddLine");
  await page.locator('#dl input[aria-label="שם פריט"]').fill("בורג M8");
  assert.strictEqual(await page.isDisabled("#bSaveNote"), true);
  await page.locator('#dl input[aria-label="כמות"]').fill("0");
  assert.strictEqual(await page.isDisabled("#bSaveNote"), true);
  await ctx.close();
});

// מוסיף פריט לניפוק מהחיפוש וממלא כמות
async function addLine(page, name, qty){
  await page.fill("#isQ", name);
  await page.dispatchEvent("#isQ", "input");
  await page.click("#isSug .slip");
  await page.locator("#isRows .kitrow").last().locator("input").fill(String(qty));
}
test("ניפוק חומרים: מסמך ניפוק + תנועת יציאה לכל פריט, והמלאי יורד", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  const before = byName(await page.evaluate(() => stockRows()));
  await page.evaluate(() => openIssue());
  await addLine(page, "בורג M8", 20);
  await addLine(page, "כבל סולארי 6", 100);
  await page.fill("#isWho", "צוות ג");
  await page.fill("#isBy", "מנפיק");
  await page.dispatchEvent("#isBy", "input");
  // חתימה באצבע
  const box = await page.locator("#isSig canvas").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 5 }); await page.mouse.up();
  assert.strictEqual(await page.isDisabled("#isSave"), false);
  await page.click("#isSave");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.keys()].some(k => k.startsWith("issues/")));
  await page.waitForTimeout(150);
  const [slip] = await docs(page, "issues");
  assert.strictEqual(slip.who, "צוות ג");
  assert.strictEqual(slip.by, "מנפיק");
  assert.deepStrictEqual(slip.lines.map(l => [l.name, l.qty]), [["בורג M8", 20], ["כבל סולארי 6", 100]]);
  assert.ok(slip.sigAsset || slip.sigUrl || slip.sigData, "חתימה נשמרה");
  const mv = (await docs(page, "moves")).filter(m => m.issueId === slip.id);
  assert.deepStrictEqual(mv.map(m => [m.item, m.qty, m.dir]).sort(), slip.lines.map(l => [l.name, l.qty, "out"]).sort());
  const after = byName(await page.evaluate(() => stockRows()));
  for (const l of slip.lines) assert.strictEqual(after[l.name].out, ((before[l.name] || {}).out || 0) + l.qty, l.name);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("ניפוק בלי חתימה: שואל קודם, ונשמר רק אחרי אישור", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openIssue());
  await addLine(page, "בורג M8", 5);
  await page.fill("#isWho", "צוות ג");
  await page.fill("#isBy", "מנפיק");
  await page.dispatchEvent("#isBy", "input");
  await page.click("#isSave");
  await page.waitForSelector("text=לשמור ניפוק בלי חתימת המקבל?");
  assert.strictEqual((await docs(page, "issues")).length, 0);
  await page.click("text=שמור בלי חתימה");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.keys()].some(k => k.startsWith("issues/")));
  const [slip] = await docs(page, "issues");
  assert.ok(!(slip.sigAsset || slip.sigUrl || slip.sigData));
  await ctx.close();
});

test("ספירה מהירה: אריזות × באריזה + בודדים, נשמרת לצד התיאורטי בלי לדרוס אותו", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openQuickCount());
  await page.fill("#qcSearch", "בורג M8");
  await page.dispatchEvent("#qcSearch", "input");
  await page.click("#qcSug .slip");
  const row = page.locator("#qcRows .kitrow").first();
  assert.match(await row.locator(".nm").textContent(), /בורג M8/);
  await row.locator('[data-k="box"]').fill("2");
  await row.locator('[data-k="per"]').fill("50");
  await row.locator('[data-k="loose"]').fill("3");
  assert.match(await row.locator('[data-k="sum"]').textContent(), /סה״כ 103.*פער −22 מול תיאורטי 125/);
  await page.fill("#qcWho", "סופר");
  await page.dispatchEvent("#qcWho", "input");
  await page.click("#qcSave");
  await page.waitForFunction(() => [...window.__MOCK_STORE__.keys()].filter(k => k.startsWith("counts/")).length === 2);
  const c = (await docs(page, "counts")).find(x => x.item === "בורג M8");
  assert.strictEqual(c.qty, 103);
  assert.strictEqual(c.who, "סופר");
  assert.strictEqual(c.note, "2 אריזות × 50 + 3 בודדים");
  await page.waitForTimeout(100);
  const r = byName(await page.evaluate(() => stockRows()));
  assert.strictEqual(r["בורג M8"].counted, 103);
  assert.strictEqual(r["בורג M8"].derived, 125);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
