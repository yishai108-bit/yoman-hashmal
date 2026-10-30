// כותב את src/js/site-maps.js מתוך src/maps/ein-tamar.json (הבסיס). אחרי שינוי בקובץ המפה:  node tools/site-maps.js && npm run build
// מופע אחר לא נוגע בקובץ הזה: הבנייה מחליפה את המחרוזת בקובץ המפה שלו (src/sites.json → map), ראו tools/build.js.
const fs = require("fs");
const path = require("path");
const { tplBody, siteMapFile } = require("./build");
const SRC = path.join(__dirname, "..", "src");
const { text, key, map } = siteMapFile("maps/ein-tamar.json", "עין תמר");
const out = `// מפות השולחנות של האתרים, לשרטוט «האתר נבנה» (19-site-build.js).
// המפה של כל אתר היא קובץ JSON ב-src/maps/ עם מפתח אחד = חלק משם האתר (SITE.name). בתוכו: w,h = מידות המפה ביחידות ציור;
// tables = [x,y,w,h,סוג] לכל שולחן, בסדר הביצוע (בעין תמר: מהשורות האחרונות למעלה עד הראשונות למטה, ובתוך שורה ממערב למזרח);
// types = פאנלים לשולחן לפי סוג; start = מתי השטח היה ריק (תחילת ציר הזמן); source = לפי מה צוירה;
// road = מסכת הדרכים (PNG קטן, לבן = דרך), לא חובה; fictive = true למפה פיקטיבית עד שיגיע שרטוט (נאמר בכרטיס).
// הבסיס כאן = src/maps/ein-tamar.json. למופע אחר הבנייה (tools/build.js, src/sites.json → map) מחליפה את המחרוזת בקובץ המפה שלו,
// ולכן לא עורכים את המחרוזת ידנית: עורכים את קובץ ה-JSON ומריצים node tools/site-maps.js (הבדיקה tests/build.test.js משווה).
export const SITE_MAPS_JSON = \`${tplBody(text)}\`;
export const SITE_MAPS = JSON.parse(SITE_MAPS_JSON);
`;
fs.writeFileSync(path.join(SRC, "js", "site-maps.js"), out);
console.log("נכתב src/js/site-maps.js · " + key + " · " + map.tables.length + " שולחנות");
