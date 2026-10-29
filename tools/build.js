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
// עין תמר הוא הבסיס; לכל מופע מוחלפים רק הכותרת ושם האתר (בכותרת ובברירת המחדל של SITE)
const BASE = { title: "<title>יומן חשמל</title>", name: "עין תמר" };
function forSite(html, site, opts){
  const swap = (s, a, b, n) => { const parts = s.split(a); if (parts.length - 1 !== n) throw new Error("ציפיתי ל-" + n + " מופעים של " + a + ", נמצאו " + (parts.length - 1)); return parts.join(b); };
  html = swap(html, BASE.title, "<title>" + site.title + "</title>", 1);
  html = swap(html, "</b>" + BASE.name + "</span>", "</b>" + site.name + "</span>", 1);
  // בפיתוח ה-JS מוגש בנפרד מה-HTML, אז שם האתר מתחלף רק בכותרת ובראש הדף
  if (opts && opts.dev) return html;
  // ברירת המחדל של SITE: בשרשור «let SITE={name:"…"», אחרי Vite «SITE = { name: "…"»
  const re = new RegExp('(SITE\\s*=\\s*\\{\\s*name:\\s*")' + BASE.name + '"', "g");
  const n = (html.match(re) || []).length;
  if (n !== 1) throw new Error("ציפיתי למופע אחד של ברירת המחדל של SITE, נמצאו " + n);
  return html.replace(re, (m, a) => a + site.name + '"');
}
module.exports = { build, forSite, OUT };

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
