// זרימות מלאות מול המאגר המדומה: קליטת תעודה, ניפוק ברגים, ספירה מהירה, מאזן פאנלים.
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

test("ניפוק ברגים: מסמך ניפוק + תנועת יציאה לכל פריט, והמלאי יורד", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  const before = byName(await page.evaluate(() => stockRows()));
  await page.evaluate(() => openIssue());
  await page.fill("#isWho", "קבלן ג");
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
  assert.strictEqual(slip.who, "קבלן ג");
  assert.strictEqual(slip.by, "מנפיק");
  assert.ok(slip.lines.length > 0);
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
  await page.fill("#isWho", "קבלן ג");
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

test("ספירה מהירה: קרטונים × בקרטון + בודדים, נשמרת לצד התיאורטי בלי לדרוס אותו", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => openQuickCount());
  await page.fill("#qcSearch", "בורג M8");
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
  assert.strictEqual(c.note, "2 קרטונים × 50 + 3 בודדים");
  await page.waitForTimeout(100);
  const r = byName(await page.evaluate(() => stockRows()));
  assert.strictEqual(r["בורג M8"].counted, 103);
  assert.strictEqual(r["בורג M8"].derived, 125);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

// מאזן פאנלים: מספרים סינתטיים (לא של אתר אמיתי)
const D = 864e5, B0 = Date.UTC(2026, 9, 1, 12);
const bal = (ts, o) => ({ ts, dateText: "", required: 10000, ordered: 10200, received: 10100, takenOut: [], brokenReasons: [], ...o });
test("מאזן פאנלים: באתר, ספייר, פער מול קבלה, קצב ושבירה מול המאזן הקודם", async () => {
  const seed = { panelbal: {
    b1: bal(B0, { closed: 7000, singles: 50, installed: 3000, scattered: 20, broken: 30 }),
    b2: bal(B0 + 10 * D, { closed: 5960, singles: 40, installed: 4000, scattered: 30, broken: 40,
      takenOut: [{ site: "אתר ב", pallets: 2, qty: 60 }],
      brokenReasons: [{ reason: "נפל משטח", qty: 25 }, { reason: "התגלו בפתיחה", qty: 15 }] }),
  } };
  const { page, ctx, errors } = await openApp(browser, { mock: { seed } });
  const c = await page.evaluate(() => pbCalc(curPb(), prevPb()));
  assert.strictEqual(c.onSite, 10070);           // 5960 + 40 + 4000 + 30 + 40
  assert.strictEqual(c.taken, 60);
  assert.strictEqual(c.spare, 70);               // באתר פחות נדרש
  assert.strictEqual(c.usable, 30);              // בלי השבורים
  assert.strictEqual(c.gap, 30);                 // 10070 מול 10100 − 60
  assert.strictEqual(c.toInstall, 6000);
  assert.strictEqual(c.dInst, 1000);
  assert.strictEqual(c.perDay, 100);
  assert.strictEqual(c.dBroken, 10);
  assert.strictEqual(c.breakRate, 0.01);         // 10 שבורים ל-1,000 מותקנים
  assert.strictEqual(c.expBroken, 60);
  assert.strictEqual(c.projected, -30);          // היום +30, בסוף חסרים 30
  assert.strictEqual(c.daysLeft, 60);
  await page.evaluate(() => showTab("over"));
  assert.match(await page.textContent("#pbBig"), /\+30/);
  assert.match(await page.textContent("#pbSub"), /יחסרו כ-30/);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("מאזן פאנלים: תנועות אחרי המאזן (הגיעו עם שבורים, יצאו לאתר אחר) מעדכנות את המצב", async () => {
  const seed = { ...fixture,                       // צריך תעודה אחת לפחות כדי לצאת ממצב הדגמה
    panelbal: { b1: bal(B0, { closed: 7000, singles: 0, installed: 3000, scattered: 0, broken: 0 }) },
    panelmoves: {
      m1: { ts: B0 + D, dir: "in", site: "אתר ב", qty: 300, pallets: 10, broken: 4 },
      m2: { ts: B0 + 2 * D, dir: "out", site: "אתר ג", qty: 100, pallets: 3 },
      m0: { ts: B0 - D, dir: "in", site: "ישן", qty: 999 },           // לפני המאזן: לא נספר
    },
  };
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  const e = await page.evaluate(() => { const b = curPb(); return { b, c: pbCalc(b, null) }; });
  assert.strictEqual(e.b.received, 10400);       // 10100 + 300
  assert.strictEqual(e.b.closed, 7196);          // 7000 + 300 − 4 שבורים − 100 שיצאו
  assert.strictEqual(e.b.broken, 4);
  assert.strictEqual(e.b.liveNotes.length, 2);
  assert.strictEqual(e.c.taken, 100);
  assert.strictEqual(e.c.onSite, 10200);
  assert.strictEqual(e.c.gap, -100);             // 10200 מול 10400 − 100
  await ctx.close();
});
