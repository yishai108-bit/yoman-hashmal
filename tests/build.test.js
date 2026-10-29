// הקוד נכתב ב-src/ ונבנה לקובץ אחד. הבדיקה מוודאת שהקובץ שבריפו הוא בדיוק הבנייה,
// ושהגרסה לכל מופע שונה מהבסיס רק בכותרת ובשם האתר.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const { build, forSite, OUT } = require("../tools/build");

test("artifact/yoman.html זהה לבנייה מ-src/", () => {
  assert.ok(fs.readFileSync(OUT, "utf8") === build(), "להריץ npm run build ולעשות commit לשניהם");
});

test("גרסת מופע: רק כותרת ושם אתר משתנים", () => {
  const base = build().split("\n");
  const site = forSite(build(), { title: "יומן חשמל · בדיקה", name: "אתר בדיקה" }).split("\n");
  assert.strictEqual(site.length, base.length);
  const diff = base.map((l, i) => l === site[i] ? null : i).filter(i => i !== null);
  assert.strictEqual(diff.length, 3);
  for (const i of diff) assert.match(site[i], /בדיקה/);
});

// קבלן נוסף על אותו קוד: מותג משלו, בלי שם החברה, הצבעים ותבניות עין תמר של S.E.E
test("מופעים ממותגים לפי src/sites.json: בלי S.E.E ובלי תבניות עין תמר", () => {
  const sites = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "src", "sites.json"), "utf8"));
  for (const [id, site] of Object.entries(sites)){
    if (!site.brand) continue;
    const html = forSite(build(), site);
    assert.ok(!html.includes("S.E.E"), id + ": נשאר S.E.E");
    assert.ok(!/F2B03D|1F5E8C/i.test(html), id + ": נשארו צבעי S.E.E");
    assert.ok(html.includes("<b>" + site.brand.company + "</b>"), id + ": שם החברה בכותרת");
    if (site.brand.noTemplates) assert.ok(!html.includes("2.1,הארקה"), id + ": נשארו סעיפי ההסכם של עין תמר");
  }
});
