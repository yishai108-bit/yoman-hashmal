// מודד כמה זמן לוקח לאפליקציה להיפתח ולצייר כשיש N רשומות, בטלפון איטי (CPU מואט פי 4).
// הרשת לא נמדדת כאן (המאגר של claude.ai), רק העבודה בטלפון. נתונים סינתטיים בלבד.
//   node tools/loadtime.js 500 2000 5000
const { chromium } = require("playwright");
const { openApp } = require("../tests/helpers");
const DAY = 864e5, T0 = Date.UTC(2026, 6, 1);
function seed(n){
  const s = { deliveries: {}, moves: {}, counts: {}, issues: {} };
  const items = Array.from({ length: 60 }, (_, i) => "פריט " + i);
  for (let i = 0; i < n; i++){
    const ts = T0 + (i % 180) * DAY, it = items[i % 60], k = i % 4;
    if (k === 0) s.deliveries["d" + i] = { supplier: "ספק " + (i % 7), noteNo: String(i), ts, source: "app",
      lines: [0, 1, 2].map(j => ({ name: items[(i + j) % 60], qty: 10 + j, unit: "יח'", cat: "construction" })) };
    else if (k === 1) s.moves["m" + i] = { item: it, qty: 2, dir: "out", who: "צוות " + (i % 5), ts };
    else if (k === 2) s.counts["c" + i] = { item: it, qty: 50, who: "סופר", ts };
    else s.issues["i" + i] = { ts, who: "קבלן " + (i % 3), lines: [{ name: it, qty: 5 }], source: "app" };
  }
  return s;
}
(async () => {
  const browser = await chromium.launch();
  for (const n of (process.argv.slice(2).length ? process.argv.slice(2) : ["500", "2000", "5000"]).map(Number)){
    const runs = [];
    for (let r = 0; r < 3; r++){
      const t = Date.now();
      const { page, ctx } = await openApp(browser, { mock: { seed: seed(n) } });
      const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.reload(); await page.waitForFunction(() => document.querySelector("#app") && !document.querySelector("#app.skel"));
      await page.waitForTimeout(300);
      const ms = await page.evaluate(() => performance.now());
      runs.push(Math.round(ms)); await ctx.close();
    }
    console.log(n + " רשומות: " + runs.join(", ") + " ms (חציון " + runs.sort((a, b) => a - b)[1] + ")");
  }
  await browser.close();
})();
