// בונה את artifact/yoman.html מהקבצים שב-src/ לפי הסדר ב-src/order.txt.
// הבנייה היא שרשור בלבד: בלי המרה, בלי מיניפיקציה, כך שהקובץ שמתפרסם זהה למה שנכתב.
//   node tools/build.js           בונה וכותב את artifact/yoman.html
//   node tools/build.js --check   בודק שהקובץ הקיים זהה לבנייה (בלי לכתוב)
//   node tools/build.js --sites   כותב גם dist/<אתר>.html לכל מופע לפי src/sites.json (הקבצים שמתפרסמים)
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "artifact", "yoman.html");

function build(){
  const order = fs.readFileSync(path.join(SRC, "order.txt"), "utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  return order.map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("");
}
// עין תמר הוא הבסיס; לכל מופע מוחלפים רק הכותרת ושם האתר (בכותרת ובברירת המחדל של SITE)
const BASE = { title: "<title>יומן אתר</title>", name: "אתר הקמה עין תמר" };
function forSite(html, site){
  const swap = (s, a, b, n) => { const parts = s.split(a); if (parts.length - 1 !== n) throw new Error("ציפיתי ל-" + n + " מופעים של " + a + ", נמצאו " + (parts.length - 1)); return parts.join(b); };
  html = swap(html, BASE.title, "<title>" + site.title + "</title>", 1);
  html = swap(html, "</b>" + BASE.name + "</span>", "</b>" + site.name + "</span>", 1);
  return swap(html, 'let SITE={name:"' + BASE.name + '"', 'let SITE={name:"' + site.name + '"', 1);
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
