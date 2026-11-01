// לקוח Supabase מדומה לבדיקות האפליקציה העצמאית (src/app/shim.js): בזיכרון, בלי רשת, רק מה שה-shim משתמש בו.
// הגדרה דרך window.__FAKE__ לפני טעינת הדף: { signedIn, email, sites:[{id,name,company,location}], members:[{site_id,role}], docs:[{site_id,coll,id,data}] }
// קוד הכניסה הנכון תמיד 123456. הכתיבות נאספות ב-window.__FAKE_WRITES__.
(function(){
  const F = window.__FAKE__ || {};
  const UID = "u-1", email = F.email || "me@see.co";
  const T = { sites: (F.sites || []).map((s, i) => ({ created_at: i, location: "", photo: "", ...s })),
    members: (F.members || []).map(m => ({ user_id: UID, ...m })), docs: (F.docs || []).map(d => ({ ...d })), invites: [], profiles: [] };
  const writes = (window.__FAKE_WRITES__ = []); window.__FAKE_T__ = T;
  // בלי רשת: F.offline (עד window.__ONLINE__) או window.__OFFLINE__ בזמן ריצה
  const off = () => !!window.__OFFLINE__ || (F.offline && !window.__ONLINE__);
  let session = F.signedIn ? { user: { id: UID, email, user_metadata: {} } } : null;
  try{ if (sessionStorage.getItem("fakeSession")) session = JSON.parse(sessionStorage.getItem("fakeSession")); }catch(e){}
  const val = (row, col) => { const m = /^data->>(.+)$/.exec(col); if (m){ const v = row.data[m[1]]; return v == null ? null : String(v); }
    if (col === "ts") return new Date(Number(row.data.ts) || 0).toISOString(); return row[col]; };
  function q(table){
    const st = { f: [], order: null, lim: 0, op: "select", body: null, single: false };
    const b = {
      select(){ return b; }, eq(c, v){ st.f.push(r => val(r, c) === (typeof v === "number" ? v : v)); return b; },
      neq(c, v){ st.f.push(r => val(r, c) !== v); return b; }, lt(c, v){ st.f.push(r => val(r, c) < v); return b; }, lte(c, v){ st.f.push(r => val(r, c) <= v); return b; },
      gt(c, v){ st.f.push(r => val(r, c) > v); return b; }, gte(c, v){ st.f.push(r => val(r, c) >= v); return b; }, in(c, v){ st.f.push(r => v.includes(val(r, c))); return b; },
      order(c, o){ if (!st.order) st.order = [c, !o || o.ascending !== false]; return b; }, limit(n){ st.lim = n; return b; }, range(a, z){ st.range = [a, z]; return b; }, maybeSingle(){ st.single = true; return b; },
      upsert(row){ st.op = "upsert"; st.body = row; return b; }, insert(row){ st.op = "insert"; st.body = row; return b; },
      update(p){ st.op = "update"; st.body = p; return b; }, delete(){ st.op = "delete"; return b; },
      then(res, rej){ return Promise.resolve().then(run).then(res, rej); },
    };
    function run(){
      if (off()) return { data: null, error: { message: "TypeError: Failed to fetch", code: "" } };
      const rows = T[table];
      const mine = r => st.f.every(f => f(r));
      if (st.op === "upsert" && F.deny && st.body.coll === F.deny) return { data: null, error: { message: "new row violates row-level security policy", code: "42501" } };
      if (st.op === "upsert"){ const k = r => r.site_id + "/" + r.coll + "/" + r.id; const i = rows.findIndex(r => k(r) === k(st.body));
        if (i >= 0) rows[i] = { ...st.body }; else rows.push({ ...st.body }); writes.push(["upsert", k(st.body)]); return { data: null, error: null }; }
      if (st.op === "insert"){ rows.push({ ...st.body }); writes.push(["insert", table]); return { data: null, error: null }; }
      if (st.op === "update"){ rows.filter(mine).forEach(r => Object.assign(r, st.body)); writes.push(["update", table]); return { data: null, error: null }; }
      if (st.op === "delete"){ T[table] = rows.filter(r => !mine(r)); writes.push(["delete", table]); return { data: null, error: null }; }
      let out = rows.filter(mine);
      if (st.order){ const [c, asc] = st.order; out = out.slice().sort((a, x) => { const p = val(a, c), y = val(x, c); return (p < y ? -1 : p > y ? 1 : 0) * (asc ? 1 : -1); }); }
      if (st.lim) out = out.slice(0, st.lim);
      if (table === "docs" && !st.lim && !st.range && !st.single && st.op === "select") out = out.slice(0, 1000); // כמו max rows של Supabase
      if (st.range) out = out.slice(st.range[0], st.range[1] + 1);

      out = JSON.parse(JSON.stringify(out));
      return { data: st.single ? (out[0] || null) : out, error: null };
    }
    return b;
  }
  window.__FAKE_SUPA__ = {
    auth: {
      getSession: async () => ({ data: { session } }),
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async ({ token }) => { if (token !== "123456") return { data: {}, error: { message: "bad" } };
        session = { user: { id: UID, email, user_metadata: {} } }; try{ sessionStorage.setItem("fakeSession", JSON.stringify(session)); }catch(e){} return { data: { session }, error: null }; },
      signOut: async () => { session = null; try{ sessionStorage.removeItem("fakeSession"); }catch(e){} return {}; },
    },
    from: q,
    rpc: async (fn, args) => {
      if (off()) return { data: null, error: { message: "TypeError: Failed to fetch", code: "" } };
      if (fn === "claim_invites") return { data: 0, error: null };
      if (fn === "create_site"){ const id = "s-" + (T.sites.length + 1); T.sites.push({ id, name: args.p_name, company: args.p_company, location: args.p_location, photo: "", created_at: 99 }); T.members.push({ site_id: id, user_id: UID, role: "owner" }); return { data: id, error: null }; }
      return { data: null, error: { message: "no fn" } };
    },
    storage: { from: () => ({ upload: async p => { if (off()) return { error: { message: "Failed to fetch" } }; writes.push(["upload", p]); return { error: null }; }, getPublicUrl: p => ({ data: { publicUrl: "https://files.test/" + p } }) }) },
  };
})();
