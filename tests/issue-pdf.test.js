// PDF לניפוק חתום (גרסה 52): קובץ לכל ניפוק, וקובץ מרוכז לתקופה
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");
const fixture = require("./fixture");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const T = Date.UTC(2026, 9, 3, 9);
const seed = {
  ...fixture,
  moves: { ...fixture.moves, m3: { ...fixture.moves.m3, sigData: PNG } },
  issues: {
    is1: { ts: T, who: "קבלן א", by: "מנפיק", tables: 10, typeLabel: "IN27", note: "",
      lines: [{ name: "בורג M8", qty: 40 }, { name: "שייבה", qty: 80 }], sigData: PNG, source: "app" },
    is2: { ts: T + 3600000, who: "קבלן ב", lines: [{ name: "בורג M8", qty: 5 }], source: "app" },
  },
};
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });

// לוחץ ומחכה לקובץ שנשמר דרך downloads (המדומה)
async function grab(page, click) {
  const n = await page.evaluate(() => window.__MOCK_SAVED__.length);
  await click();
  await page.waitForFunction(n => window.__MOCK_SAVED__.length > n, n, { timeout: 15000 });
  const f = await page.evaluate(async () => { const f = window.__MOCK_SAVED__.at(-1);
    return { name: f.filename, bytes: Array.from(new Uint8Array(await f.data.arrayBuffer())) }; });
  return { name: f.name, buf: Buffer.from(f.bytes) };
}

test("ניפוק חומרים בודד: PDF בשם אתר_תאריך_מקבל_מספר", async () => {
  const { page, ctx, errors } = await openApp(browser, { mock: { seed } });
  await page.evaluate(() => openSlip(shared.issues.find(s => s.id === "is1")));
  const { name, buf } = await grab(page, () => page.click("#slPdf"));
  assert.strictEqual(name, "עין-תמר_2026-10-03_קבלן-א_2.pdf");
  assert.strictEqual(buf.subarray(0, 5).toString(), "%PDF-");
  assert.deepStrictEqual(errors, []);
  await ctx.close();
});

test("ניפוק ציוד חתום: PDF מתוך כרטיס הציוד", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  await page.evaluate(() => openMoveSlip("צוות 2", "מקדחה"));
  const { name } = await grab(page, () => page.click("[data-mpdf='m3']"));
  assert.match(name, /^עין-תמר_2026-10-03_צוות-2_\d+\.pdf$/);
  await ctx.close();
});

test("PDF מרוכז לתקופה: רק ניפוקים חתומים, עמוד לכל ניפוק", async () => {
  const { page, ctx } = await openApp(browser, { mock: { seed } });
  await page.evaluate(() => openAllSlips(shared.issues.slice()));
  await page.fill("#irFrom", "2026-10-01");
  await page.dispatchEvent("#irFrom", "change");
  assert.match(await page.textContent("#irHint"), /^2 ניפוקים חתומים.*2 ללא חתימה/);
  const { name, buf } = await grab(page, () => page.click("#irGo"));
  assert.match(name, /^עין-תמר_ניפוקים-חתומים_2026-10-01_עד_\d{4}-\d\d-\d\d\.pdf$/);
  assert.strictEqual((buf.toString("latin1").match(/\/Type \/Page /g) || []).length, 2);
  await ctx.close();
});
