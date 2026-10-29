const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

test("נטען בלי שגיאות JS, ברוחב 400 בלי גלילה אופקית", async () => {
  const { page, errors, ctx } = await openApp(browser, { mock: { seed: fixture } });
  assert.deepStrictEqual(errors, []);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "גלילה אופקית: " + overflow + "px");
  await ctx.close();
});
