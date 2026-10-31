// בונה את artifact/yoman.html מ-src/ בעזרת Vite (vite.config.mjs): מודולים ב-src/js, נכנסים לקובץ HTML אחד.
//   node tools/build.js           בונה וכותב את artifact/yoman.html
//   node tools/build.js --check   בודק שהקובץ הקיים זהה לבנייה (בלי לכתוב)
//   node tools/build.js --sites   כותב גם dist/<אתר>.html לכל מופע לפי src/sites.json (הקבצים שמתפרסמים)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "artifact", "yoman.html");

let cached = null;
function build(){
  if (cached) return cached;
  execFileSync(process.execPath, [path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js"), "build", "--logLevel", "error"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  return (cached = fs.readFileSync(path.join(ROOT, "dist", "build", "index.html"), "utf8"));
}
// עין תמר הוא הבסיס; לכל מופע מוחלפים רק הכותרת ושם האתר (בכותרת ובברירת המחדל של SITE), ובמופע עם map גם מפת השולחנות
const BASE = { title: "<title>יומן חשמל</title>", name: "עין תמר" };
function forSite(html, site, opts){
  const swap = (s, a, b, n) => { const parts = s.split(a); if (parts.length - 1 !== n) throw new Error("ציפיתי ל-" + n + " מופעים של " + a + ", נמצאו " + (parts.length - 1)); return parts.join(b); };
  html = swap(html, BASE.title, "<title>" + site.title + "</title>", 1);
  html = swap(html, "</b>" + BASE.name + "</span>", "</b>" + site.name + "</span>", 1);
  if (site.brand) html = brand(html, site.brand, swap);
  // בפיתוח ה-JS מוגש בנפרד מה-HTML, אז שם האתר מתחלף רק בכותרת ובראש הדף
  if (opts && opts.dev) return html;
  // ברירת המחדל של SITE: בשרשור «let SITE={name:"…"», אחרי Vite «SITE = { name: "…"»
  const re = new RegExp('(SITE\\s*=\\s*\\{\\s*name:\\s*")' + BASE.name + '"', "g");
  const n = (html.match(re) || []).length;
  if (n !== 1) throw new Error("ציפיתי למופע אחד של ברירת המחדל של SITE, נמצאו " + n);
  html = html.replace(re, (m, a) => a + site.name + '"');
  if (site.brand) html = brandJs(html, site.brand, swap);
  if (site.map) html = siteMapJs(html, site.map, site.name);
  return html;
}
// מיתוג של קבלן אחר על אותו קוד (src/sites.json → brand): צבעים, סמל בכותרת, שם חברה, תוספת CSS.
// כל החלפה נבדקת: אם מחרוזת הבסיס השתנתה ב-src הבנייה נכשלת, לא מפרסמת מופע חצי ממותג.
const BASE_MARK = /<svg class="mark"[\s\S]*?<\/svg>/;
function brand(html, b, swap){
  if (b.mark){ if (!BASE_MARK.test(html)) throw new Error("לא נמצא הסמל בכותרת (svg.mark)"); const svg = fs.readFileSync(path.join(SRC, b.mark), "utf8").trim(); html = html.replace(BASE_MARK, () => svg); }
  // סמל נפרד למסמכים המיוצאים (דוח יומי): נכנס כתבנית נסתרת, והקוד מעדיף אותו על סמל הכותרת
  if (b.docMark){ const svg = fs.readFileSync(path.join(SRC, b.docMark), "utf8").trim(); html = swap(html, '<span class="site" id="siteName">', '<template id="docMark">' + svg + '</template><span class="site" id="siteName">', 1); }
  if (b.company) html = swap(html, "<b>S.E.E</b>", "<b>" + b.company + "</b>", 1);
  for (const [from, to] of Object.entries(b.colors || {})){
    const re = new RegExp(from, "gi");
    if (!re.test(html)) throw new Error("הצבע " + from + " לא נמצא בבנייה");
    html = html.replace(re, to);
  }
  // התוספת אחרי ה-CSS של האפליקציה (תגית ה-style האחרונה בקובץ), כדי שתגבר עליו
  if (b.css){ const i = html.lastIndexOf("</style>"); if (i < 0) throw new Error("לא נמצא </style>"); html = html.slice(0, i) + b.css + html.slice(i); }
  return html;
}
// בתוך ה-JS: שם החברה כברירת מחדל, ובלי תבניות עין תמר (סעיפי הסכם, סוגי כבלים, כתב כמויות) אצל קבלן אחר
function brandJs(html, b, swap){
  if (b.company){
    const n = html.split('"S.E.E"').length - 1; if (!n) throw new Error('לא נמצא "S.E.E" ב-JS');
    html = html.split('"S.E.E"').join(JSON.stringify(b.company));
  }
  // noTemplates מרוקן את שלוש התבניות; templates נותן למופע קובץ CSV משלו (src/brands/…), באותן עמודות, במקום תבנית עין תמר
  const TPL = { activities: "ACTIVITY_TEMPLATE_CSV", cableTypes: "CABLE_TYPES_TEMPLATE_CSV", boq: "BOQ_CABLES_TEMPLATE_CSV" };
  const setTpl = (name, body) => { const re = new RegExp("(const " + name + " = `[^\\n]*\\n)[^`]*`"); if (!re.test(html)) throw new Error("לא נמצאה התבנית " + name); html = html.replace(re, (m, head) => head + body + "`"); };
  if (b.noTemplates) for (const name of Object.values(TPL)) setTpl(name, "");
  for (const [k, file] of Object.entries(b.templates || {})){
    if (!TPL[k]) throw new Error("תבנית לא מוכרת: " + k);
    const lines = fs.readFileSync(path.join(SRC, file), "utf8").replace(/^\uFEFF/, "").split("\n");
    if (/[`\\]|\$\{/.test(lines.join("\n"))) throw new Error("התבנית " + file + " מכילה תווים שאסורים בתוך template literal");
    setTpl(TPL[k], lines.slice(1).join("\n").replace(/\n*$/, "\n"));   // בלי שורת הכותרת של הקובץ: הכותרת של הבסיס נשארת
  }
  for (const [from, to] of b.text || []) html = swap(html, from, to, 1);
  return html;
}
// מפת השולחנות של המופע (השולחנות במקומם במפת האתר): src/sites.json → map = קובץ JSON ב-src/maps/ עם מפתח אחד (חלק משם האתר) ובו w,h,tables….
// הבסיס (src/js/site-maps.js) מחזיק את עין תמר כמחרוזת SITE_MAPS_JSON; כאן המחרוזת מוחלפת בקובץ של המופע, באותו קידוד של template literal.
const tplBody = s => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const MAP_RE = /(const SITE_MAPS_JSON = `)[^`]*`/;
function siteMapFile(file, siteName){
  const text = fs.readFileSync(path.join(SRC, file), "utf8").replace(/^\uFEFF/, "").trim();
  const obj = JSON.parse(text), keys = Object.keys(obj);
  if (keys.length !== 1 || !Array.isArray(obj[keys[0]].tables)) throw new Error("קובץ מפה צריך מפתח אחד (חלק משם האתר) עם tables: " + file);
  if (siteName != null && !siteName.includes(keys[0])) throw new Error("מפתח המפה «" + keys[0] + "» אינו חלק משם האתר «" + siteName + "» (" + file + ")");
  return { key: keys[0], text, map: obj[keys[0]] };
}
function siteMapJs(html, file, siteName){
  const { text } = siteMapFile(file, siteName);
  if (!MAP_RE.test(html)) throw new Error("לא נמצאה מפת השולחנות בבנייה (SITE_MAPS_JSON)");
  return html.replace(MAP_RE, (m, head) => head + tplBody(text) + "`");
}
module.exports = { build, forSite, OUT, tplBody, siteMapFile, MAP_RE };

if (require.main === module){
  const out = build();
  if (process.argv.includes("--check")){
    const cur = fs.readFileSync(OUT, "utf8");
    if (cur !== out){ console.error("artifact/yoman.html לא זהה לבנייה מ-src/. להריץ: npm run build"); process.exit(1); }
    console.log("זהה לבנייה.");
  } else {
    fs.writeFileSync(OUT, out);
    console.log("נכתב " + path.relative(ROOT, OUT) + " · " + out.split("\n").length + " שורות");
  }
  if (process.argv.includes("--sites")){
    const sites = JSON.parse(fs.readFileSync(path.join(SRC, "sites.json"), "utf8"));
    fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
    for (const [id, site] of Object.entries(sites)){ fs.writeFileSync(path.join(ROOT, "dist", id + ".html"), forSite(out, site)); console.log("dist/" + id + ".html"); }
  }
}
