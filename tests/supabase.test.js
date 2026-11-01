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
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('app.email', true)) $$;`);
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

  // גרסה 25: הזמנה לפי מייל → חברות בכניסה הראשונה; אתר חדש רק לבעלים בחברה
  const asMail = async (uid, email, fn) => { await db.exec("set role app"); await db.query("select set_config('app.uid',$1,false), set_config('app.email',$2,false)", [uid, email]);
    try { return await fn(); } finally { await db.exec("reset role"); } };
  const NEW = "00000000-0000-0000-0000-000000000042";
  const tryQ = async q => { try { await db.query(q[0], q[1]); return true; } catch (e) { return false; } };
  assert.strictEqual(await as("editor", () => tryQ(["insert into invites values ($1,'x@y.co',  'editor')", [site]])), false);
  assert.strictEqual(await as("owner", () => tryQ(["insert into invites values ($1,'new@see.co','editor')", [site]])), true);
  const n = await asMail(NEW, "New@SEE.co", async () => (await db.query("select claim_invites() n")).rows[0].n);
  assert.strictEqual(n, 1);
  assert.strictEqual((await db.query("select role from members where user_id=$1", [NEW])).rows[0].role, "editor");
  assert.strictEqual((await db.query("select count(*)::int c from invites")).rows[0].c, 0);
  await db.query("update sites set company='see' where id=$1", [site]);
  assert.strictEqual(await asMail(NEW, "new@see.co", () => tryQ(["select create_site('see','זר','')", []])), false);
  assert.strictEqual(await asMail(U.stranger, "s@x.co", () => tryQ(["select create_site('see','זר','')", []])), false);
  const sid = await asMail(U.owner, "o@see.co", async () => (await db.query("select create_site('see','אתר ב','נגב') id")).rows[0].id);
  assert.strictEqual((await db.query("select role from members where site_id=$1 and user_id=$2", [sid, U.owner])).rows[0].role, "owner");
  const mine = await as("editor", async () => (await db.query("select id from sites where company='see'")).rows.length);
  assert.strictEqual(mine, 1, "עורך באתר א לא רואה את אתר ב");
  await db.close();
});
