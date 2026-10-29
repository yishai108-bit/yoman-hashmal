// הופך גיבוי של האפליקציה (קובץ JSON מ«גיבוי» בהגדרות) לקובץ SQL שמכניס את הכול לטבלת docs.
// לא מתחבר לשום מקום: מייצר קובץ שמריצים ידנית ב-Supabase אחרי בדיקה.
//   node tools/supabase-import.js backup.json ein-tamar "אתר הקמה עין תמר" > ein-tamar.sql
// הקובץ שנוצר מכיל נתוני חברה: לא לריפו ולא לשום מקום משותף.
const fs = require("fs");

const COLLS = ["deliveries","moves","counts","concrete","issues","progress","panelbal","panelmoves",
  "daylog","crew","status","orders","pos","eta","panels","log"];

function toSql(backup, slug, name){
  if (backup.app !== "yoman-atar") throw new Error("זה לא גיבוי של יומן אתר");
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  const rows = [];
  const add = (coll, id, data) => rows.push("(" + ["(select id from s)", q(coll), q(id), q(JSON.stringify(data)) + "::jsonb"].join(",") + ")");
  for (const coll of COLLS) for (const d of backup[coll] || []){
    if (!d || d.id == null) continue;
    const { id, ...data } = d; add(coll, String(id), data);
  }
  // הגדרות: אותם מסמכים כמו ב-settings/* של ה-artifact
  if (backup.bom) add("settings", "bom", backup.bom);
  if (backup.boq) add("settings", "boq", backup.boq);
  if (backup.suppliers) add("settings", "suppliers", { map: backup.suppliers });
  if (backup.cba) add("settings", "cba", backup.cba);
  if (backup.prices) add("settings", "prices", backup.prices);
  if (backup.site) add("settings", "site", backup.site);
  const out = ["begin;",
    "insert into sites (slug, name) values (" + q(slug) + "," + q(name) + ") on conflict (slug) do nothing;",
    "with s as (select id from sites where slug = " + q(slug) + ")",
    "insert into docs (site_id, coll, id, data) values"];
  out.push(rows.length ? rows.join(",\n") : "((select id from s),'settings','_empty','{}'::jsonb)");
  out.push("on conflict (site_id, coll, id) do update set data = excluded.data;", "commit;");
  return { sql: out.join("\n") + "\n", count: rows.length };
}
module.exports = { toSql, COLLS };

if (require.main === module){
  const [file, slug, name] = process.argv.slice(2);
  if (!file || !slug || !name){ console.error("שימוש: node tools/supabase-import.js backup.json <slug> <שם האתר>"); process.exit(1); }
  const { sql, count } = toSql(JSON.parse(fs.readFileSync(file, "utf8")), slug, name);
  process.stdout.write(sql); console.error(count + " מסמכים");
}
