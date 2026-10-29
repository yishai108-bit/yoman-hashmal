// פס «אין חיבור» (גרסה 52)
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const barText = page => page.evaluate(() => { const b = document.querySelector("#netBar"); return b && !b.hidden ? b.textContent : ""; });

test("חיבור תקין: אין פס", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed: fixture } });
  assert.strictEqual(await barText(page), "");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("מאגר לא נטען: פס «נשאר במכשיר הזה בלבד»", async () => {
  const { page, ctx } = await openApp(browser, { mock: { noDb: true } });
  assert.match(await barText(page), /במכשיר הזה בלבד/);
  await ctx.close();
});

test("האזנה למאגר מתה: פס «החיבור נותק»", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await page.evaluate(() => window.__MOCK_KILL__());
  await page.waitForTimeout(50);
  assert.match(await barText(page), /נותק/);
  await ctx.close();
});

test("אין אינטרנט ואז חוזר: הפס מופיע ונעלם", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed: fixture } });
  await ctx.setOffline(true); await page.waitForTimeout(50);
  assert.match(await barText(page), /אין חיבור לאינטרנט/);
  // הפס לא מסתיר את הלשוניות
  const [barB, tabsT] = await page.evaluate(() => [document.querySelector("#netBar").getBoundingClientRect().bottom, document.querySelector(".tabs").getBoundingClientRect().top]);
  assert.ok(tabsT >= barB - 1, "הלשוניות מתחת לפס");
  await ctx.setOffline(false); await page.waitForTimeout(50);
  assert.strictEqual(await barText(page), "");
  await ctx.close();
});
