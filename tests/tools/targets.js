// מוצא כפתורים קטנים מ-44px (גובה או רוחב) בכל הלשוניות ובכמה חלונות. שימוש: node tests/tools/targets.js
const { launch, openApp } = require("../helpers");
const fixture = require("../fixture");
const scan = page => page.evaluate(() => {
  const out = new Map();
  document.querySelectorAll("button, [role=button], select, input[type=date], .chip2, .tgl, label.shot, summary").forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const st = getComputedStyle(el); if (st.visibility === "hidden" || st.display === "none") return;
    if (r.height < 44 || r.width < 44) {
      const key = (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : el.tagName.toLowerCase()) + (el.id ? "#" + el.id : "");
      if (!out.has(key)) out.set(key, Math.round(r.width) + "x" + Math.round(r.height) + " «" + (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20) + "»");
    }
  });
  return [...out.entries()];
});
(async () => {
  const browser = await launch();
  const { page } = await openApp(browser, { mock: { seed: fixture } });
  const all = new Map();
  const add = (where, list) => list.forEach(([k, v]) => { if (!all.has(k)) all.set(k, where + ": " + v); });
  for (const t of ["Over", "Stock", "Concrete", "Panels", "Day", "Orders"]) {
    await page.click("#tab" + t); await page.waitForTimeout(100);
    await page.evaluate(() => document.querySelectorAll(".card.folded h3").forEach(h => h.click()));
    await page.waitForTimeout(100);
    add(t, await scan(page));
  }
  const sheets = [["Stock", "#btnNote"], ["Over", "#btnIssue2"], ["Stock", "#btnCount"], ["Orders", "#btnOrder"], ["Day", "#btnDayAdd"], ["Over", "#btnSettings"], ["Panels", "#btnAdd"]];
  for (const [t, b] of sheets) {
    await page.click("#tab" + t);
    const ok = await page.$(b + ":visible"); if (!ok) continue;
    await page.click(b); await page.waitForTimeout(150);
    add("sheet " + b, await scan(page));
    await page.evaluate(() => document.querySelectorAll(".scrim").forEach(s => s.remove()));
  }
  for (const [k, v] of all) console.log(k.padEnd(40), v);
  await browser.close();
})();
