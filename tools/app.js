// בונה את האפליקציה העצמאית (בלי Claude) לכל חברה ב-src/app/apps.json:
//   node tools/app.js            → dist/app/<חברה>/ : index.html, manifest.webmanifest, sw.js, אייקונים (--icons: לצייר מחדש, --from-artifact: בלי Vite)
// אותו קוד כמו ה-artifact (מהבנייה של tools/build.js, עם המיתוג של המופע), ועוד:
//   src/app/shim.js לפני הקוד: window.claude על Supabase (כניסה, מאגר, קבצים)
//   מניפסט + service worker: «הוסף למסך הבית» באייפון/אייפד נפתח כאפליקציה במסך מלא
// כתובת הפרויקט והמפתח הציבורי (anon) של Supabase ב-apps.json. המפתח הזה ציבורי מטבעו; ההגנה היא ב-RLS (supabase/schema.sql).
const fs = require("fs");
const path = require("path");
const { build, forSite, OUT } = require("./build.js");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

function appHtml(base, cfg, site, version){
  let html = forSite(base, site);
  const conf = { url: cfg.url, key: cfg.key, company: cfg.company, name: cfg.name };
  const head = '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="' + cfg.theme + '">'
    + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    + '<meta name="apple-mobile-web-app-title" content="' + cfg.short + '"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
    + "<script>window.YOMAN_APP=" + JSON.stringify(conf) + ";</script>"
    + "<script>" + fs.readFileSync(path.join(SRC, "app", "shim.js"), "utf8") + "</script>"
    + "<script>if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>";
  const i = html.indexOf("<head>"); if (i < 0) throw new Error("לא נמצא <head>");
  html = html.slice(0, i + 6) + head + html.slice(i + 6);
  html = html.replace(/<title>[^<]*<\/title>/, "<title>" + cfg.title + "</title>");
  return html;
}
// אייקון: הסמל מהכותרת של המופע על רקע לבן, מצויר ב-Chromium (Playwright מותקן בסביבת הבדיקות)
async function icons(html, dir, bg){
  const m = html.match(/<svg class="mark"[\s\S]*?<\/svg>/); if (!m) throw new Error("לא נמצא סמל לאייקון");
  const svg = m[0].replace('class="mark"', 'width="100%" height="100%"');
  const { chromium } = require("playwright");
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, n] of [["icon-512.png", 512], ["icon-192.png", 192], ["apple-touch-icon.png", 180]]){
    await p.setViewportSize({ width: n, height: n });
    await p.setContent('<body style="margin:0;background:' + bg + ';display:flex;align-items:center;justify-content:center;width:' + n + 'px;height:' + n + 'px"><div style="width:62%;height:62%">' + svg + "</div></body>");
    await p.screenshot({ path: path.join(dir, name) });
  }
  await b.close();
}
async function main(){
  // --from-artifact: מהקובץ שכבר נבנה (artifact/yoman.html) בלי להריץ Vite; הבדיקות רצות במקביל, ובנייה כאן הייתה מוחקת את dist/build באמצע בדיקה אחרת
  const base = process.argv.includes("--from-artifact") ? fs.readFileSync(OUT, "utf8") : build();
  const version = (base.match(/APP_VERSION\s*=\s*"(\d+)"/) || [])[1] || "0";
  const apps = JSON.parse(fs.readFileSync(path.join(SRC, "app", "apps.json"), "utf8"));
  const sites = JSON.parse(fs.readFileSync(path.join(SRC, "sites.json"), "utf8"));
  for (const [key, cfg] of Object.entries(apps)){
    const dir = path.join(ROOT, "dist", "app", key); fs.mkdirSync(dir, { recursive: true });
    const html = appHtml(base, cfg, sites[cfg.site], version);
    fs.writeFileSync(path.join(dir, "index.html"), html);
    fs.writeFileSync(path.join(dir, "manifest.webmanifest"), JSON.stringify({
      name: cfg.title, short_name: cfg.short, lang: "he", dir: "rtl", start_url: "./", scope: "./", display: "standalone",
      background_color: "#ffffff", theme_color: cfg.theme,
      icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
    }, null, 1));
    fs.writeFileSync(path.join(dir, "sw.js"), fs.readFileSync(path.join(SRC, "app", "sw.js"), "utf8").replace("__VERSION__", version));
    // האייקונים שמורים בריפו (src/app/icons/<חברה>/), כדי שהבנייה בשרת האחסון לא תצטרך דפדפן. --icons מצייר אותם מחדש מהסמל.
    const idir = path.join(SRC, "app", "icons", key);
    if (process.argv.includes("--icons") || !fs.existsSync(idir)){ fs.mkdirSync(idir, { recursive: true }); await icons(html, idir, "#ffffff"); }
    for (const f of fs.readdirSync(idir)) fs.copyFileSync(path.join(idir, f), path.join(dir, f));
    console.log("dist/app/" + key + "/" + (cfg.url ? "" : "  (אין עדיין כתובת Supabase ב-src/app/apps.json)"));
  }
}
module.exports = { appHtml };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
