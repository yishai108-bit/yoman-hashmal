// סביבת הפיתוח (npm run dev, Vite): האפליקציה עולה עם הנתונים המדומים, ושמירת קובץ ב-src/ טוענת מחדש.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { launch, ROOT } = require("./helpers");

let vite = null;
try { require.resolve("vite"); vite = true; } catch (e) {}

test("npm run dev מגיש את האפליקציה וטוען מחדש בשינוי ב-src/", { skip: !vite && "vite לא מותקן" }, async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ configFile: path.join(ROOT, "vite.config.mjs"), logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const url = "http://localhost:" + server.httpServer.address().port + "/";
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector("#app") && !document.querySelector("#app.skel"), null, { timeout: 8000 });
    assert.deepStrictEqual(errors, []);
    assert.ok(await page.evaluate(() => window.__MOCK_STORE__.has("deliveries/n1")), "נתוני הדוגמה לא נטענו");
    // שומרים קובץ בלי לשנות אותו: הדף אמור להיטען מחדש
    await page.evaluate(() => { window.__before = 1; });
    const f = path.join(ROOT, "src", "js", "17-eta.js");
    await page.waitForTimeout(300);
    fs.writeFileSync(f, fs.readFileSync(f, "utf8"));
    await page.waitForFunction(() => !window.__before, null, { timeout: 8000 });
    // מופע אחר דרך ?site=
    await page.goto(url + "?site=moledet&empty=1");
    assert.match(await page.title(), /מולדת/);
  } finally { await browser.close(); await server.close(); }
});
