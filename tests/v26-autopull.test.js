// גרסה 26: המלאי מתעדכן לבד. דיווח ביצוע על משיכת כבל במטרים מוריד מהתוף, בלי טופס משיכה נפרד.
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
  { code: "DC6-BK", desc: "כבל סולארי 6 שחור", aliases: ["סטרינג 6 שחור", "סולארי שחור"] },
  { code: "PE25", desc: "הארקה נחושת 25", aliases: ["הארקה 25"] },
] };
const drums = {
  d1: { id: "d1", drumNo: "1001", cableType: "DC6-BK", lengthIn: 1000, status: "full", ts: 1 },
  d2: { id: "d2", drumNo: "1002", cableType: "DC6-BK", lengthIn: 1000, status: "inUse", ts: 2 },
  d3: { id: "d3", drumNo: "2001", cableType: "PE25", lengthIn: 500, status: "full", ts: 3 },
};
const status = {
  st_c: { id: "st_c", name: "משיכת כבל סולארי 6 שחור", unit: "מ׳", order: 1, total: 5000, workDays: 20, start: "2026-10-01", group: "כבלים", daily: [] },
  st_t: { id: "st_t", name: "חפירת תעלות", unit: "מ׳", order: 2, total: 800, workDays: 10, start: "2026-10-01", group: "תעלות", daily: [] },
};

test("דיווח משיכה: התוף שבשימוש נבחר לבד, המטרים יורדים, עריכה ומחיקה מתעדכנות", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { settings: { cableTypes }, drums, status } } });
  await page.waitForFunction(() => (shared.drums || []).length === 3 && (shared.STATUS || []).length === 2);
  // סעיף שאינו כבל: אין שדה תוף
  await page.evaluate(() => openWorkReport({ activityId: "st_t" }));
  assert.strictEqual(await page.isHidden("#prDrumF"), true);
  await page.click(".pr-sheet .cancel:not(.danger)");
  // סעיף כבל: התוף שכבר בשימוש מהסוג הנכון נבחר מראש, הארקה לא בקבוצה המתאימה
  await page.evaluate(() => openWorkReport({ activityId: "st_c" }));
  assert.strictEqual(await page.isHidden("#prDrumF"), false);
  assert.strictEqual(await page.inputValue("#prDrum"), "d2");
  await page.fill("#prQty", "300");
  assert.match(await page.textContent("#prDrumHint"), /אחרי הדיווח 700/);
  await page.click("#prSave");
  await page.waitForFunction(() => (shared.pulls || []).length === 1);
  let pulls = await docs(page, "pulls");
  assert.deepStrictEqual(pulls.map(p => [p.drumId, p.meters, p.auto]), [["d2", 300, true]]);
  assert.strictEqual(await page.evaluate(() => drumRemain(shared.drums.find(d => d.id === "d2"))), 700);
  // עריכה: כמות חדשה ותוף אחר → אותה משיכה מתעדכנת, לא נוספת
  const wid = pulls[0].workId;
  await page.evaluate(id => openWorkReport({ activityId: "st_c", entry: shared.STATUS.find(a => a.id === "st_c").daily.find(x => x.id === id) }), wid);
  assert.strictEqual(await page.inputValue("#prDrum"), "d2");
  await page.fill("#prQty", "250"); await page.selectOption("#prDrum", "d1");
  await page.click("#prSave");
  await page.waitForFunction(() => shared.pulls.length === 1 && shared.pulls[0].drumId === "d1" && shared.pulls[0].meters === 250);
  assert.strictEqual((await docs(page, "drums")).find(d => d.id === "d1").status, "inUse");
  // «בלי תוף» בעריכה: המשיכה נמחקת
  await page.evaluate(id => openWorkReport({ activityId: "st_c", entry: shared.STATUS.find(a => a.id === "st_c").daily.find(x => x.id === id) }), wid);
  await page.selectOption("#prDrum", "");
  await page.click("#prSave");
  await page.waitForFunction(() => shared.pulls.length === 0);
  assert.strictEqual((await docs(page, "pulls")).length, 0);
  // מחיקת דיווח מוחקת את המשיכה שלו
  await page.evaluate(() => openWorkReport({ activityId: "st_c" }));
  await page.fill("#prQty", "100"); await page.click("#prSave");
  await page.waitForFunction(() => shared.pulls.length === 1);
  const e2 = await page.evaluate(() => shared.STATUS.find(a => a.id === "st_c").daily.slice(-1)[0].id);
  await page.evaluate(id => openWorkReport({ activityId: "st_c", entry: shared.STATUS.find(a => a.id === "st_c").daily.find(x => x.id === id) }), e2);
  await page.click("#prDel");
  await page.click(".sheet .save, .ask .save, button:has-text('מחק') >> nth=-1").catch(() => {});
  await page.waitForFunction(() => shared.pulls.length === 0);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("כתיבה חופשית «משיכת הארקה 25»: תוף ההארקה נבחר לבד", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: { settings: { cableTypes }, drums } } });
  await page.waitForFunction(() => (shared.drums || []).length === 3);
  await page.evaluate(() => openWorkReport());
  await page.selectOption("#prAct", "__free");
  await page.fill("#prFree", "משיכת הארקה 25 בתעלה B1");
  assert.strictEqual(await page.inputValue("#prDrum"), "d3");
  await page.fill("#prQty", "120"); await page.click("#prSave");
  await page.waitForFunction(() => (shared.pulls || []).length === 1);
  assert.deepStrictEqual((await docs(page, "pulls")).map(p => [p.drumNo, p.meters]), [["2001", 120]]);
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});
