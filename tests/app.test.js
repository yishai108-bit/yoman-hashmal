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
  await page.fill("#agCode", "111111"); await page.click(".ag-go");
  await page.waitForFunction(() => /לא נכון/.test(document.querySelector(".ag-msg").textContent));
  await page.fill("#agCode", "123456");
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

test("אפליקציה: אוסף מעל 1000 רשומות נקרא כולו (Supabase מחזיר עד 1000 לבקשה)", async () => {
  const docs = []; for (let i = 0; i < 2350; i++) docs.push({ site_id: "A", coll: "moves", id: "m" + String(i).padStart(5, "0"), data: { id: "m" + i, ts: 1, qty: 1 } });
  const { page, errors } = await boot({ ...fake, signedIn: true, docs: fake.docs.concat(docs) });
  await page.evaluate(() => localStorage.setItem("curSite", "A")); await page.reload();
  await page.waitForFunction(() => window.shared && shared.moves && shared.moves.length > 0);
  assert.strictEqual(await page.evaluate(() => shared.moves.length), 2350);
  assert.deepStrictEqual(errors, []);
});

test("אפליקציה: אתר חדש מקבל את השם שלו מהשרת ולא את המפה של אתר ברירת המחדל; בלי קליטה מסך «אין חיבור», לא «אין לך אתרים»", async () => {
  const { page, errors } = await boot({ ...fake, signedIn: true, offline: true });
  await page.waitForFunction(() => /אין חיבור/.test((document.querySelector("#appGate") || {}).textContent || ""));
  assert.ok(!(await page.$(".mys-empty")));
  await page.evaluate(() => { window.__ONLINE__ = true; document.querySelector("#appGate .ag-go").click(); });
  await page.waitForSelector(".mys-card");
  await page.click(".mys-card");
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 1);
  const r = await page.evaluate(() => ({ title: document.title, tables: document.body.innerHTML.includes("לאתר יש מפת שולחנות"), ein: /עין תמר/.test(document.body.innerText) }));
  assert.deepStrictEqual(r, { title: "S.E.E · אתר צפון (דוגמה)", tables: false, ein: false });
  assert.deepStrictEqual(errors, []);
});

test("אפליקציה בלי קליטה: נפתחת מהמכשיר, שמירות ותמונות נכנסות לתור, ונשלחות לבד כשהקליטה חוזרת", async () => {
  const { page, errors } = await boot({ ...fake, signedIn: true });
  await page.addInitScript(() => { if (localStorage.getItem("offTest")) window.__OFFLINE__ = true; });
  await page.evaluate(() => localStorage.setItem("curSite", "A")); await page.reload();
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 1 && shared.daylog && shared.daylog.length === 1);
  await page.waitForTimeout(500);   // המראה נשמר במכשיר (IndexedDB)
  // הקליטה נעלמת, והאפליקציה נפתחת מחדש: אותם אתר ונתונים, מהמכשיר
  await page.evaluate(() => localStorage.setItem("offTest", "1")); await page.reload();
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 1 && shared.daylog && shared.daylog.length === 1);
  assert.ok(await page.evaluate(() => window.__OFFLINE__ === true), "הדף נפתח מחדש בלי רשת");
  assert.ok(!(await page.$("#appGate")) && !(await page.$(".mys-empty")));
  // שמירה, מחיקה ותמונה בלי רשת: מיד באפליקציה, בתור, לא בשרת
  const r = await page.evaluate(async () => {
    await shared.DB.doc("daylog/off1").set({ id: "off1", date: "2026-01-02", name: "בלי קליטה", ts: 2 });
    await shared.DB.doc("daylog/w1").delete();
    const a = await claude.use("assets").then(x => x.upload(new Blob(["x"], { type: "image/jpeg" })));
    await new Promise(r => setTimeout(r, 50));
    return { ids: shared.daylog.map(d => d.id), pending: claude.__app.pending(), server: __FAKE_T__.docs.filter(d => d.coll === "daylog").map(d => d.id),
      url: a.url, badge: (document.querySelector("#appSync") || {}).textContent || "" };
  });
  assert.deepStrictEqual(r.ids, ["off1"]);
  assert.strictEqual(r.pending, 3);
  assert.deepStrictEqual(r.server, ["w1"]);
  assert.match(r.url, /^https:\/\/files\.test\/A\//);
  assert.match(r.badge, /אין קליטה · 3 שמירות ממתינות לשליחה/);
  // הקליטה חוזרת: התור נשלח לפי הסדר, והפס נעלם
  await page.evaluate(() => { localStorage.removeItem("offTest"); window.__OFFLINE__ = false; dispatchEvent(new Event("online")); });
  await page.waitForFunction(() => claude.__app.pending() === 0 && !document.querySelector("#appSync"));
  const s = await page.evaluate(() => ({ server: __FAKE_T__.docs.filter(d => d.site_id === "A" && d.coll === "daylog").map(d => d.id),
    up: __FAKE_WRITES__.filter(w => w[0] === "upload").length, ids: shared.daylog.map(d => d.id) }));
  assert.deepStrictEqual(s, { server: ["off1"], up: 1, ids: ["off1"] });
  assert.deepStrictEqual(errors, []);
});

test("אפליקציה: שמירה שהשרת דוחה (הרשאה) לא נתקעת בתור וחוזרת כשגיאה", async () => {
  const { page, errors } = await boot({ ...fake, signedIn: true, deny: "settings" });
  await page.evaluate(() => localStorage.setItem("curSite", "A")); await page.reload();
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 1);
  const r = await page.evaluate(async () => { let code = ""; try{ await shared.DB.doc("settings/x").set({ a: 1 }); }catch(e){ code = e.code; }
    const g = await shared.DB.doc("settings/x").get(); return { code, pending: claude.__app.pending(), exists: g.exists }; });
  assert.deepStrictEqual(r, { code: "permission_denied", pending: 0, exists: false });
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

test("אפליקציה: קריאת מסמכים דרך פונקציית השרת כשיש מפתח, ומוסתרת כשאין", async () => {
  const ai = { text: "```json\n{\"supplier\":\"ספק דוגמה\",\"lines\":[{\"name\":\"כבל סולארי\",\"qty\":2,\"unit\":\"תוף\"}]}\n```" };
  let { page, errors } = await boot({ ...fake, signedIn: true, ai });
  await page.waitForSelector(".mys-card"); await page.click(".mys-card");
  await page.waitForFunction(() => window.shared && shared.DB && shared.STATUS && shared.STATUS.length === 1);
  await page.waitForFunction(() => !!shared.SAMPLE);
  const r = await page.evaluate(async () => {
    const blob = await new Promise(res => { const c = document.createElement("canvas"); c.width = c.height = 8; c.toBlob(res, "image/jpeg"); });
    const out = await shared.SAMPLE.json("תעודה", { images: blob });
    return { out, calls: __FAKE_WRITES__.filter(w => w[0] === "fn").map(w => w[2]) };
  });
  assert.deepStrictEqual(r.out, { supplier: "ספק דוגמה", lines: [{ name: "כבל סולארי", qty: 2, unit: "תוף" }] });
  assert.ok(r.calls.includes("ping") && r.calls.includes(1), JSON.stringify(r.calls));
  assert.deepStrictEqual(errors, []);
  ({ page, errors } = await boot({ ...fake, signedIn: true }));
  await page.waitForSelector(".mys-card"); await page.click(".mys-card");
  await page.waitForFunction(() => window.shared && shared.DB && shared.STATUS && shared.STATUS.length === 1);
  assert.strictEqual(await page.evaluate(() => shared.SAMPLE), null);
  assert.deepStrictEqual(errors, []);
});
