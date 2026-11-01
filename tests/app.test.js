// אפליקציה עצמאית (בלי Claude): dist/app/see/index.html עם לקוח Supabase מדומה (tests/fake-supa.js).
// כניסה במייל + קוד → «האתרים שלי» (כרטיס לכל אתר, תג חריגים, חיפוש) → האתר נפתח עם הנתונים שלו בלבד, וכתיבה הולכת לאתר הזה.
// נתונים סינתטיים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { launch, ROOT } = require("./helpers");

const APP = path.join(ROOT, "dist", "app", "see", "index.html");
const FAKE = fs.readFileSync(path.join(__dirname, "fake-supa.js"), "utf8");
let browser;
test.before(async () => { execFileSync(process.execPath, [path.join(ROOT, "tools", "app.js"), "--from-artifact"], { stdio: "ignore" }); browser = await launch(); });
test.after(async () => { await browser.close(); });
const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const T = isoOf(new Date());
const fake = {
  sites: [{ id: "A", name: "אתר צפון (דוגמה)", company: "see", location: "נגב" }, { id: "B", name: "אתר דרום (דוגמה)", company: "see", location: "ערבה" },
          { id: "C", name: "אתר של חברה אחרת", company: "mse" }, { id: "D", name: "אתר בלי חברות", company: "see" }],
  members: [{ site_id: "A", role: "owner" }, { site_id: "B", role: "editor" }, { site_id: "C", role: "owner" }],
  docs: [
    { site_id: "A", coll: "status", id: "a1", data: { id: "a1", name: "סעיף", total: 100, manDays: 10, order: 1, daily: [{ id: "d", date: T, actual: 40, workers: 2, ts: 1 }] } },
    { site_id: "A", coll: "daylog", id: "w1", data: { id: "w1", date: T, name: "עובד", contractor: "צוות א", ts: 1 } },
    { site_id: "B", coll: "status", id: "b1", data: { id: "b1", name: "סעיף ב", total: 10, manDays: 1, order: 1, daily: [] } },
    { site_id: "B", coll: "blockers", id: "k1", data: { id: "k1", date: T, kind: "material", text: "חסר", status: "open", ts: 1 } },
    { site_id: "B", coll: "blockers", id: "k2", data: { id: "k2", date: T, kind: "safety", text: "גדר", status: "open", ts: 1 } },
  ],
};
async function boot(fakeCfg, view){
  const ctx = await browser.newContext({ viewport: view || { width: 400, height: 860 }, locale: "he-IL" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.route(/^https?:\/\//, r => r.abort());
  await page.addInitScript(`window.__FAKE__=${JSON.stringify(fakeCfg)};\n${FAKE}`);
  await page.goto("file://" + APP);
  return { page, ctx, errors };
}

test("אפליקציה: כניסה בקוד, «האתרים שלי» רק של החברה ושל החברויות, פתיחת אתר עם הנתונים שלו", async () => {
  const { page, errors } = await boot(fake);
  await page.waitForSelector("#agMail");
  await page.fill("#agMail", "me@see.co"); await page.click(".ag-go");
  await page.waitForSelector("#agCode");
  await page.fill("#agCode", "11111111"); await page.click(".ag-go");
  await page.waitForFunction(() => /לא נכון/.test(document.querySelector(".ag-msg").textContent));
  await page.fill("#agCode", "12345678");
  await page.waitForSelector(".mys-card");
  await page.waitForFunction(() => document.querySelectorAll(".mys-meta span").length >= 3);
  let r = await page.evaluate(() => ({
    title: document.querySelector(".mys-top h1").textContent,
    cards: [...document.querySelectorAll(".mys-card")].map(c => [c.querySelector("b").textContent, c.querySelector(".mys-txt span").textContent,
      c.querySelector(".mys-badge").hidden ? "" : c.querySelector(".mys-badge").textContent]),
    add: !!document.querySelector("#mysAdd"), gate: !!document.querySelector("#appGate"), app: getComputedStyle(document.querySelector("#app")).display,
  }));
  assert.deepStrictEqual(r, { title: "האתרים שלי", cards: [["אתר צפון (דוגמה)", "נגב", ""], ["אתר דרום (דוגמה)", "ערבה", "2 חריגים פתוחים"]], add: true, gate: false, app: "none" });
  await page.fill("#mysQ", "ערבה");
  assert.deepStrictEqual(await page.evaluate(() => [...document.querySelectorAll(".mys-card")].map(c => c.hidden)), [true, false]);
  await page.click(".mys-card:not([hidden])");
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 1 && shared.STATUS[0].id === "b1");
  r = await page.evaluate(async () => {
    await shared.DB.doc("daylog/wx").set({ id: "wx", date: "2026-01-01", name: "בדיקה", ts: 1 });
    return { site: document.querySelector("#siteName").textContent, role: [...document.body.classList].find(c => c.startsWith("r-")), blk: shared.blockers.length,
      wrote: __FAKE_T__.docs.some(d => d.site_id === "B" && d.coll === "daylog" && d.id === "wx"), mys: !!document.querySelector(".my-sites"),
      cur: localStorage.getItem("curSite"), blob: blobUrl("B/x1") };
  });
  assert.deepStrictEqual(r, { site: "S.E.Eאתר דרום (דוגמה)", role: "r-editor", blk: 2, wrote: true, mys: false, cur: "B", blob: "https://files.test/B/x1" });
  assert.deepStrictEqual(errors, []);
});

test("אפליקציה: מחובר עם אתר שמור נכנס ישר לאתר; לחיצה על שם האתר חוזרת ל«האתרים שלי»; בעלים יוצר אתר", async () => {
  const { page, errors } = await boot({ ...fake, signedIn: true }, { width: 1280, height: 800 });
  await page.waitForSelector(".mys-card");
  await page.evaluate(() => localStorage.setItem("curSite", "A"));
  await page.reload();
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 1 && shared.STATUS[0].id === "a1");
  assert.ok(await page.evaluate(() => document.body.classList.contains("r-owner")));
  await page.click("#siteName");
  await page.waitForSelector(".mys-card");
  page.on("dialog", d => d.accept(d.message().includes("שם") ? "אתר חדש (דוגמה)" : "גליל"));
  await page.click("#mysAdd");
  await page.waitForFunction(() => document.querySelectorAll(".mys-card").length === 3);
  const names = await page.evaluate(() => [...document.querySelectorAll(".mys-txt b")].map(b => b.textContent));
  assert.deepStrictEqual(names, ["אתר צפון (דוגמה)", "אתר דרום (דוגמה)", "אתר חדש (דוגמה)"]);
  assert.deepStrictEqual(errors, []);
});

test("אפליקציה: מניפסט ומסך הבית", async () => {
  const dir = path.dirname(APP);
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.webmanifest"), "utf8"));
  assert.strictEqual(m.display, "standalone"); assert.strictEqual(m.dir, "rtl");
  const html = fs.readFileSync(APP, "utf8");
  assert.ok(html.includes('rel="manifest"') && html.includes("apple-mobile-web-app-capable") && html.includes("window.YOMAN_APP="));
  assert.ok(!/באר טוביה|MSE/.test(html.replace(/"mse"/g, "")), "מופע S.E.E בלי MSE");
});
