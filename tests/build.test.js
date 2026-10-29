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
