// הקוד נכתב ב-src/ ונבנה לקובץ אחד. הבדיקה מוודאת שהקובץ שבריפו הוא בדיוק הבנייה,
// ושהגרסה לכל מופע שונה מהבסיס רק בכותרת ובשם האתר.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { build, forSite, OUT, tplBody, siteMapFile, MAP_RE } = require("../tools/build");
const SRC = path.join(__dirname, "..", "src");
const SITES = () => JSON.parse(fs.readFileSync(path.join(SRC, "sites.json"), "utf8"));

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
  for (const [id, site] of Object.entries(SITES())){
    if (!site.brand) continue;
    const html = forSite(build(), site);
    assert.ok(!html.includes("S.E.E"), id + ": נשאר S.E.E");
    assert.ok(!/F2B03D|1F5E8C/i.test(html), id + ": נשארו צבעי S.E.E");
    assert.ok(html.includes("<b>" + site.brand.company + "</b>"), id + ": שם החברה בכותרת");
    if (site.brand.noTemplates) assert.ok(!html.includes("הארקה 25 משולחנות עד תחנת ממירים"), id + ": נשארו סעיפי ההסכם של עין תמר");
    if (site.brand.templates && site.brand.templates.activities) assert.ok(html.includes("עבודות עפר") && !html.includes("ACTIVITY_TEMPLATE_CSV = `\uFEFFcode,name,unit,total,manDays,start,workDays,group,desc\n`"), id + ": תבנית הסעיפים של המופע לא נכנסה");
    // גרסה 20: שום «עין תמר» במופע אחר (לא בתוויות, לא במפה), תבנית סוגי הכבלים של המופע נכנסה במקום של S.E.E, והמפה של המופע נכנסה
    assert.ok(!html.includes("עין תמר") && !html.includes("EIT_M_90"), id + ": נשארו שם האתר או מפת השולחנות של עין תמר");
    if (site.brand.templates && site.brand.templates.cableTypes){
      const first = fs.readFileSync(path.join(SRC, site.brand.templates.cableTypes), "utf8").split("\n")[1].split(",")[0];
      assert.ok(html.includes("\n" + first + ",") && !html.includes("3x1x120"), id + ": תבנית סוגי הכבלים של המופע לא נכנסה");
    }
    if (site.map) assert.ok(html.includes('"' + siteMapFile(site.map, site.name).key + '": {'), id + ": מפת השולחנות של המופע לא נכנסה");
  }
});

// גרסה 20: מפת השולחנות היא קובץ לכל אתר (src/maps). הבסיס שבקוד = עין תמר, מאותו קובץ; המופע של S.E.E זהה לבסיס מלבד הכותרת
test("מפת השולחנות לכל אתר: site-maps.js זהה ל-maps/ein-tamar.json, קובצי המפות תקינים, ומופע S.E.E = הבסיס מלבד הכותרת", () => {
  const src = fs.readFileSync(path.join(SRC, "js", "site-maps.js"), "utf8");
  const m = src.match(MAP_RE); assert.ok(m, "אין SITE_MAPS_JSON ב-site-maps.js");
  assert.strictEqual(m[0].slice(m[1].length, -1), tplBody(siteMapFile("maps/ein-tamar.json", "עין תמר").text), "site-maps.js לא זהה ל-maps/ein-tamar.json: להריץ node tools/site-maps.js");
  for (const [id, site] of Object.entries(SITES())){
    if (!site.map) continue;
    const { key, map } = siteMapFile(site.map, site.name);
    assert.ok(site.name.includes(key), id + ": מפתח המפה אינו חלק משם האתר");
    assert.ok(map.w > 0 && map.h > 0 && map.tables.length >= 4 && map.tables.every(t => t.length === 5 && t.every(n => typeof n === "number")), id + ": מפה לא תקינה");
    assert.ok(map.tables.every(t => t[0] >= 0 && t[1] >= 0 && t[0] + t[2] <= map.w && t[1] + t[3] <= map.h), id + ": שולחן מחוץ למפה");
    assert.ok(Object.keys(map.types || {}).length && map.tables.every(t => map.types[t[4]] > 0), id + ": סוג שולחן בלי מספר פאנלים");
  }
  const base = build().split("\n"), see = forSite(build(), SITES()["see-ein-tamar"]).split("\n");
  assert.strictEqual(see.length, base.length);
  const diff = base.map((l, i) => l === see[i] ? null : i).filter(i => i !== null);
  assert.strictEqual(diff.length, 1, "מופע S.E.E שונה מהבסיס ביותר מהכותרת: שורות " + diff.join(","));
  assert.match(see[diff[0]], /<title>/);
});
