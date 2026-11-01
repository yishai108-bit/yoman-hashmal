// גרסה 25: כמה אתרים במופע אחד של חברה. האתר הראשון בשורש המאגר (הנתונים הקיימים לא זזים),
// כל אתר נוסף במרחב sites/<id>/; בורר אתר, «אתר חדש», מסך «כל האתרים». נתונים סינתטיים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const { launch, openApp } = require("./helpers");

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser.close(); });
const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const T = isoOf(new Date());
const act = (id, total, done) => ({ id, code: "1." + id, name: "סעיף " + id, unit: "מ׳", group: "א", order: 1, total, manDays: 10,
  daily: done ? [{ id: "d" + id, date: T, actual: done, crew: "צוות א", workers: 2, ts: 1 }] : [] });
const worker = (id, contractor) => ({ id, date: T, name: "עובד " + id, contractor, in: "07:00", out: "16:00", ts: 1 });
const seed = {
  settings: { site: { name: "אתר ראשון", company: "S.E.E", ts: 1 },
    sites: { list: [{ id: "main", name: "אתר ראשון", root: true }, { id: "s2", name: "אתר שני" }, { id: "s3", name: "אתר שלישי" }], ts: 1 } },
  status: { a1: act("a1", 100, 50) },
  daylog: { w1: worker("w1", "צוות א") },
  "sites/s2/settings": { site: { name: "אתר שני", company: "S.E.E", ts: 1 } },
  "sites/s2/status": { b1: act("b1", 100, 20), b2: act("b2", 100, 0) },
  "sites/s2/daylog": { w2: worker("w2", "צוות ב"), w3: worker("w3", "קבלן משנה") },
  "sites/s2/blockers": { k1: { id: "k1", date: T, kind: "safety", text: "גדר פתוחה", status: "open", ts: 1 } },
};

test("אתרים: כל אתר רואה רק את הנתונים שלו, וכתיבה הולכת למרחב של האתר הפתוח", async () => {
  const { page, errors } = await openApp(browser, { mock: { seed } });
  await page.waitForFunction(() => shared.STATUS.length === 1);
  let r = await page.evaluate(() => ({ site: document.querySelector("#siteName").textContent, st: shared.STATUS.map(a => a.id), day: shared.daylog.length, sites: sitesList().length }));
  assert.deepStrictEqual(r, { site: "S.E.Eאתר ראשון", st: ["a1"], day: 1, sites: 3 });

  await page.evaluate(() => localStorage.setItem("curSite", "s2"));
  await page.reload();
  await page.waitForFunction(() => window.shared && shared.STATUS && shared.STATUS.length === 2, null, { timeout: 8000 });
  r = await page.evaluate(async () => {
    await shared.DB.doc("daylog/wx").set({ id: "wx", date: "2026-01-01", name: "בדיקה" });
    return { site: document.querySelector("#siteName").textContent, st: shared.STATUS.map(a => a.id).sort(), blk: shared.blockers.length,
      inSite: __MOCK_STORE__.has("sites/s2/daylog/wx"), inRoot: __MOCK_STORE__.has("daylog/wx") };
  });
  assert.deepStrictEqual(r, { site: "S.E.Eאתר שני", st: ["b1", "b2"], blk: 1, inSite: true, inRoot: false });
  assert.deepStrictEqual(errors, []);
});

test("אתרים: מסך «כל האתרים» מסכם כל אתר; בעלים מוסיף אתר חדש", async () => {
  const { page, errors } = await openApp(browser, { mock: { seed }, width: 1280 });
  await page.waitForFunction(() => shared.STATUS.length === 1);
  await page.evaluate(() => openAllSites());
  await page.waitForFunction(() => /אתרים ·/.test((document.querySelector("#saSum") || {}).textContent || ""));
  const r = await page.evaluate(() => ({
    sum: document.querySelector("#saSum").textContent,
    cards: [...document.querySelectorAll(".site-card")].map(c => [c.querySelector("b").textContent, c.querySelector(".pc").textContent,
      [...c.querySelectorAll(".row em")].map(e => e.textContent)]),
    wide: document.querySelector(".sites-sheet").getBoundingClientRect().width,
  }));
  assert.strictEqual(r.sum, "3 אתרים · 3 עובדים היום · 1 חריגים פתוחים · 3 בלי דיווח היום");
  assert.deepStrictEqual(r.cards.map(c => c.slice(0, 2)), [["אתר ראשון", "50%"], ["אתר שני", "10%"], ["אתר שלישי", "—"]]);
  assert.deepStrictEqual(r.cards[1][2].slice(0, 2), ["2 · 2 צוותים", "1"]);
  assert.ok(r.wide > 900, "במחשב החלון רחב: " + r.wide);

  await page.evaluate(() => { document.querySelectorAll(".scrim").forEach(x => x.remove()); openSites(); });
  await page.fill("#siNew", "אתר רביעי");
  await page.click("#siAdd");
  await page.waitForFunction(() => sitesList().length === 4);
  const w = await page.evaluate(() => {
    const list = __MOCK_STORE__.get("settings/sites").list; const id = list[3].id;
    return { names: list.map(s => s.name), root: list[0].root, site: __MOCK_STORE__.get("sites/" + id + "/settings/site").name,
      rows: [...document.querySelectorAll(".site-row b")].map(b => b.textContent) };
  });
  assert.deepStrictEqual(w, { names: ["אתר ראשון", "אתר שני", "אתר שלישי", "אתר רביעי"], root: true, site: "אתר רביעי",
    rows: ["אתר ראשון", "אתר שני", "אתר שלישי", "אתר רביעי"] });
  assert.deepStrictEqual(errors, []);
});

test("אתרים: מופע בלי רשימת אתרים עובד כמו קודם (אתר אחד בשורש), ועורך לא רואה «אתר חדש»", async () => {
  const { page, errors } = await openApp(browser, { mock: { role: "editor", seed: { settings: { site: { name: "עין תמר בדיקה", company: "S.E.E", ts: 1 } }, status: { a1: act("a1", 10, 1) } } } });
  await page.waitForFunction(() => shared.STATUS.length === 1);
  const r = await page.evaluate(() => { openSites(); return { n: sitesList().length, root: sitesList()[0].root, add: !!document.querySelector("#siAdd"), all: !!document.querySelector("#siAll"),
    rows: [...document.querySelectorAll(".site-row b")].map(b => b.textContent) }; });
  assert.deepStrictEqual(r, { n: 1, root: true, add: false, all: false, rows: ["עין תמר בדיקה"] });
  assert.deepStrictEqual(errors, []);
});
