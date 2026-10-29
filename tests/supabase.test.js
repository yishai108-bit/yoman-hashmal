// סכמת Supabase (supabase/schema.sql) והייבוא מגיבוי, על Postgres בזיכרון (PGlite).
// בודק שההרשאות זהות לאלה של ה-artifact: צופה קורא, עורך כותב חוץ מ-settings, cba ו-prices לבעלים בלבד.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { toSql } = require("../tools/supabase-import");
const fixture = require("./fixture");

let PGlite; try { ({ PGlite } = require("@electric-sql/pglite")); } catch (e) {}
const U = { owner: "00000000-0000-0000-0000-000000000001", editor: "00000000-0000-0000-0000-000000000002",
  viewer: "00000000-0000-0000-0000-000000000003", stranger: "00000000-0000-0000-0000-000000000009" };

test("סכמה, ייבוא והרשאות", { skip: !PGlite && "חסר @electric-sql/pglite (מותקן ב-CI)" }, async () => {
  const db = new PGlite();
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;`);
  await db.exec(fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8"));
  const backup = { app: "yoman-atar", site: { name: "אתר בדיקה" }, bom: { lines: [] }, prices: { panel: 1 }, cba: { packages: [] },
    deliveries: Object.entries(fixture.deliveries).map(([id, d]) => ({ id, ...d })),
    moves: Object.entries(fixture.moves).map(([id, d]) => ({ id, ...d })) };
  const { sql, count } = toSql(backup, "test", "אתר בדיקה");
  assert.strictEqual(count, 2 + 3 + 4);
  await db.exec(sql);
  const site = (await db.query("select id from sites where slug='test'")).rows[0].id;
  for (const [r, u] of Object.entries(U)) if (r !== "stranger")
    await db.query("insert into members values ($1,$2,$3)", [site, u, r]);
  await db.exec("create role app; grant usage on schema public, auth to app; grant all on all tables in schema public to app; grant execute on all functions in schema public, auth to app;");

  const as = async (who, fn) => { await db.exec("set role app"); await db.query("select set_config('app.uid',$1,false)", [U[who]]);
    try { return await fn(); } finally { await db.exec("reset role"); } };
  const ids = who => as(who, async () => (await db.query("select coll||'/'||id k from docs order by 1")).rows.map(r => r.k));
  const write = (who, coll, id) => as(who, async () => { try { await db.query("insert into docs (site_id,coll,id,data) values ($1,$2,$3,'{\"ts\":1}')", [site, coll, id]); return true; } catch (e) { return false; } });

  assert.strictEqual((await ids("owner")).length, 9);
  assert.ok(!(await ids("editor")).some(k => k === "settings/cba" || k === "settings/prices"));
  assert.ok((await ids("editor")).includes("settings/bom"));
  assert.ok(!(await ids("viewer")).includes("settings/prices"));
  assert.deepStrictEqual(await ids("stranger"), []);
  assert.strictEqual(await write("viewer", "moves", "v1"), false);
  assert.strictEqual(await write("editor", "moves", "e1"), true);
  assert.strictEqual(await write("editor", "settings", "suppliers"), false);
  assert.strictEqual(await write("owner", "settings", "suppliers"), true);
  assert.strictEqual(await write("stranger", "moves", "s1"), false);
  const by = (await db.query("select updated_by from docs where id='e1'")).rows[0].updated_by;
  assert.strictEqual(by, U.editor);
  const ts = (await db.query("select ts from docs where coll='deliveries' and id='n1'")).rows[0].ts;
  assert.strictEqual(new Date(ts).getTime(), fixture.deliveries.n1.ts);
  await db.close();
});
