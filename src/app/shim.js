/* אפליקציה עצמאית (בלי Claude): window.claude מדומה על Supabase.
   נכנס לדף רק בבנייה `node tools/build.js --app` (לפני הקוד של האפליקציה), עם window.YOMAN_APP = {url, key, company, name}.
   האפליקציה עצמה לא משתנה: היא מבקשת claude.use("db"|"user"|"assets"|"downloads") כמו ב-artifact, ומקבלת כאן אותו ממשק:
   - db: מסמכים בטבלה docs (site_id, coll, id, data) במקום מאגר ה-artifact; onSnapshot = שאילתה + עדכון בזמן אמת (realtime)
   - user: המשתמש המחובר ותפקידו באתר הפתוח (members)
   - assets: תמונות וחתימות ב-Storage (bucket «files»)
   - downloads: קובץ למכשיר (שיתוף בטלפון, הורדה במחשב)
   - sample (AI): עדיין לא, מחזיר null והאפליקציה מסתירה את מה שתלוי בו
   כניסה: מייל → קוד בן 6 ספרות במייל (לא קישור: קישור נפתח ב-Safari ולא באפליקציה המותקנת במסך הבית).
   בבדיקות: window.__FAKE_SUPA__ = לקוח מדומה באותו ממשק, בלי רשת. */
(function(){
  const CFG = window.YOMAN_APP || {};
  const SUPA_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  let sb = null, session = null, sites = null, roles = {}, current = null;

  function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); }); }
  async function client(){
    if (sb) return sb;
    if (window.__FAKE_SUPA__) return (sb = window.__FAKE_SUPA__);
    if (!window.supabase) await loadScript(SUPA_JS);
    sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
    return sb;
  }
  const err = (code, message) => Object.assign(new Error(message || code), { code });
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));

  /* ---------- כניסה ---------- */
  function ui(html){
    let el = document.getElementById("appGate");
    if (!el){ el = document.createElement("div"); el.id = "appGate"; el.className = "app-gate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
    el.innerHTML = '<div class="ag-box"><div class="ag-brand"></div>' + html + '</div>';
    el.querySelector(".ag-brand").textContent = CFG.name || "יומן חשמל";
    const mk = document.querySelector(".top h1 .mark"); if (mk){ const c = mk.cloneNode(true); c.setAttribute("class", "ag-mark"); el.querySelector(".ag-box").insertBefore(c, el.querySelector(".ag-brand")); }
    return el;
  }
  function login(){
    return new Promise(resolve => {
      const step1 = (msg) => {
        const el = ui('<h2>כניסה</h2><p class="ag-sub">נכנסים עם המייל. נשלח אליך קוד בן 6 ספרות.</p>'
          + '<label for="agMail">מייל</label><input id="agMail" type="email" inputmode="email" autocomplete="email" dir="ltr" placeholder="name@company.co.il">'
          + '<div class="ag-msg" role="status"></div><button class="ag-go" type="button">שלח קוד</button>');
        const m = el.querySelector("#agMail"), go = el.querySelector(".ag-go");
        m.value = localStorage.getItem("appMail") || ""; if (msg) el.querySelector(".ag-msg").textContent = msg;
        const send = async () => {
          const email = m.value.trim().toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ el.querySelector(".ag-msg").textContent = "צריך מייל תקין."; m.focus(); return; }
          go.disabled = true; go.textContent = "שולח…";
          const { error } = await (await client()).auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
          if (error){ go.disabled = false; go.textContent = "שלח קוד"; const em = String(error.message || ""); console.warn("signInWithOtp", error);
            el.querySelector(".ag-msg").textContent = /rate|seconds|security purposes/i.test(em) ? "כבר נשלח קוד. אפשר לבקש שוב בעוד דקה." : "השליחה נכשלה (" + (error.status || "") + " " + em.slice(0, 80) + "). נסה שוב בעוד דקה."; return; }
          try{ localStorage.setItem("appMail", email); }catch(e){}
          step2(email);
        };
        go.onclick = send; m.onkeydown = e => { if (e.key === "Enter") send(); }; setTimeout(() => m.focus(), 50);
      };
      const step2 = (email) => {
        const el = ui('<h2>הקוד מהמייל</h2><p class="ag-sub"></p>'
          + '<label for="agCode">קוד</label><input id="agCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" dir="ltr" placeholder="קוד מהמייל">'
          + '<div class="ag-msg" role="status"></div><button class="ag-go" type="button">כניסה</button><button class="ag-back" type="button">מייל אחר</button>');
        el.querySelector(".ag-sub").textContent = "נשלח אל " + email + ". אם לא הגיע, לבדוק בספאם.";
        const c = el.querySelector("#agCode"), go = el.querySelector(".ag-go");
        const verify = async () => {
          const token = c.value.replace(/\D/g, "");
          if (token.length < 6 || token.length > 10){ el.querySelector(".ag-msg").textContent = "להקליד את כל הספרות מהמייל."; return; }
          go.disabled = true;
          const { data, error } = await (await client()).auth.verifyOtp({ email, token, type: "email" });
          if (error || !data || !data.session){ go.disabled = false; el.querySelector(".ag-msg").textContent = "הקוד לא נכון או שפג תוקפו."; c.select(); return; }
          resolve(data.session);
        };
        go.onclick = verify; c.oninput = () => { if (c.value.replace(/\D/g, "").length === 6) verify(); }; // ב-Supabase הוגדר קוד של 6 ספרות (Email OTP length); קוד ארוך יותר עובר בכפתור
        el.querySelector(".ag-back").onclick = () => step1();
        setTimeout(() => c.focus(), 50);
      };
      step1();
    });
  }
  async function signedIn(){
    const s = await client();
    const { data } = await s.auth.getSession();
    session = data && data.session;
    if (!session) session = await login();
    // הזמנות שחיכו למייל הזה הופכות לחברות באתרים (פונקציה בשרת)
    try{ await s.rpc("claim_invites"); }catch(e){}
    await loadSites();
    const g = document.getElementById("appGate"); if (g) g.remove();
    return session;
  }
  async function loadSites(){
    const s = await client();
    const [{ data: rows }, { data: mem }] = await Promise.all([
      s.from("sites").select("id,slug,name,location,photo,company").eq("company", CFG.company).order("created_at"),
      s.from("members").select("site_id,role").eq("user_id", session.user.id),
    ]);
    roles = {}; (mem || []).forEach(m => { roles[m.site_id] = m.role; });
    sites = (rows || []).filter(r => roles[r.id]).map(r => ({ id: r.id, name: r.name, location: r.location || "", photo: r.photo || "", role: roles[r.id] }));
  }

  /* ---------- מאגר: אותו ממשק כמו ה-artifact ---------- */
  const subs = new Set(); const channels = {};
  function snapDoc(id, data){ return { id, exists: data !== undefined, data: () => clone(data), metadata: { fromCache: false, hasPendingWrites: false } }; }
  function siteDb(S){
    const run = async q => {
      let r = sb.from("docs").select("id,data").eq("site_id", S).eq("coll", q.coll);
      for (const [f, op, v] of q.where){
        const col = f === "ts" ? "ts" : "data->>" + f, val = f === "ts" ? new Date(v).toISOString() : v;
        r = op === "==" ? r.eq(col, val) : op === "!=" ? r.neq(col, val) : op === "<" ? r.lt(col, val) : op === "<=" ? r.lte(col, val)
          : op === ">" ? r.gt(col, val) : op === ">=" ? r.gte(col, val) : op === "in" ? r.in(col, v) : r;
      }
      if (q.order) r = r.order(q.order[0] === "ts" ? "ts" : "data->>" + q.order[0], { ascending: q.order[1] !== "desc" });
      if (q.lim) r = r.limit(q.lim);
      const { data, error } = await r; if (error) throw err("unavailable", error.message);
      const docs = (data || []).map(x => snapDoc(x.id, x.data));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    const getDoc = async (coll, id) => {
      const { data, error } = await sb.from("docs").select("data").eq("site_id", S).eq("coll", coll).eq("id", id).maybeSingle();
      if (error) throw err("unavailable", error.message);
      return snapDoc(id, data ? data.data : undefined);
    };
    const refresh = coll => setTimeout(() => subs.forEach(s => { if (s.site === S && s.coll === coll && !s.dead) s.pull(); }), 0);
    const listen = () => {
      if (channels[S] || !sb.channel) return;
      channels[S] = sb.channel("docs-" + S).on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "site_id=eq." + S },
        p => refresh((p.new && p.new.coll) || (p.old && p.old.coll))).subscribe();
    };
    const write = async (coll, id, fn) => {
      const { error } = await fn(); if (error) throw err(/permission|policy|rls/i.test(error.message || "") ? "permission_denied" : "invalid_argument", error.message);
      refresh(coll);
    };
    const split = p => { const a = String(p).split("/"); if (a.length !== 2) throw new TypeError("נתיב מסמך: אוסף/מזהה"); return a; };
    const docRef = path => { const [coll, id] = split(path); return {
      id, path,
      get: () => getDoc(coll, id),
      set: data => write(coll, id, () => sb.from("docs").upsert({ site_id: S, coll, id, data: clone(data) })),
      async update(patch){ const cur = await getDoc(coll, id); if (!cur.exists) throw err("invalid_argument", "missing");
        const merge = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? merge(o[k], v) : v; return o; };
        return write(coll, id, () => sb.from("docs").update({ data: merge(cur.data(), clone(patch)) }).eq("site_id", S).eq("coll", coll).eq("id", id)); },
      delete: () => write(coll, id, () => sb.from("docs").delete().eq("site_id", S).eq("coll", coll).eq("id", id)),
      onSnapshot(next, error){ listen(); const s = { site: S, coll, dead: false, pull: () => getDoc(coll, id).then(x => !s.dead && next(x), e => error && error(e)) };
        subs.add(s); s.pull(); return () => { s.dead = true; subs.delete(s); }; },
    }; };
    const query = q => ({
      where: (f, op, v) => query({ ...q, where: [...q.where, [f, op, v]] }),
      orderBy: (f, d) => query({ ...q, order: [f, d || "asc"] }),
      limit: n => query({ ...q, lim: n }),
      get: () => run(q),
      onSnapshot(next, error){ listen(); const s = { site: S, coll: q.coll, dead: false, pull: () => run(q).then(x => !s.dead && next(x), e => error && error(e)) };
        subs.add(s); s.pull(); return () => { s.dead = true; subs.delete(s); }; },
    });
    const coll = c => { if (String(c).includes("/")) throw new TypeError("אוסף בלי /"); return Object.assign(query({ coll: c, where: [], order: null, lim: 0 }), {
      path: c, doc: id => docRef(c + "/" + (id || crypto.randomUUID())),
      async add(data){ const r = docRef(c + "/" + crypto.randomUUID()); await r.set(data); return r; },
    }); };
    return { doc: docRef, collection: coll };
  }

  /* ---------- קבצים, הורדות, משתמש ---------- */
  const assets = {
    async upload(blob){
      const id = crypto.randomUUID().replace(/-/g, ""), path = current + "/" + id;
      const { error } = await sb.storage.from("files").upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
      if (error) throw err("unavailable", error.message);
      return { id: path, url: sb.storage.from("files").getPublicUrl(path).data.publicUrl, sizeBytes: blob.size, contentType: blob.type };
    },
  };
  const downloads = {
    async save({ filename, data }){
      const blob = data instanceof Blob ? data : new Blob([data]);
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare && /Mobi|iPad|Android/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })){
        try{ await navigator.share({ files: [file], title: filename }); return; }catch(e){ if (e && e.name === "AbortError") throw err("declined"); }
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    },
  };
  const user = {
    isOwner: async () => roles[current] === "owner",
    canEdit: async () => roles[current] === "owner" || roles[current] === "editor",
    can: async n => n === "data.write" ? (roles[current] === "owner" || roles[current] === "editor") : null,
    id: async () => session.user.id,
    me: async () => { const m = session.user.user_metadata || {}; const role = roles[current];
      return { id: session.user.id, name: m.name || String(session.user.email || "").split("@")[0], email: session.user.email || "", avatarUrl: "", isOwner: role === "owner", canEdit: role === "owner" || role === "editor", guest: false }; },
    profiles: async ids => { const out = {}; try{ const { data } = await sb.from("profiles").select("user_id,name").in("user_id", ids); (data || []).forEach(p => { out[p.user_id] = { id: p.user_id, name: p.name || "" }; }); }catch(e){} return out; },
    search: async () => [],
  };

  /* ---------- window.claude ---------- */
  let ready = null;
  const boot = () => ready || (ready = new Promise(r => { if (document.body) r(); else document.addEventListener("DOMContentLoaded", r); }).then(signedIn));
  window.claude = {
    use: async name => {
      await boot();
      if (name === "db") return { __app: true, forSite: id => siteDb(id) };
      if (name === "user") return user;
      if (name === "assets") return assets;
      if (name === "downloads") return downloads;
      return null;
    },
    // לשכבת האתרים (29-sites.js): רשימת האתרים של המשתמש, בחירת אתר, יציאה
    __app: {
      company: CFG.company, name: CFG.name || "",
      sites: () => (sites || []).slice(),
      open(id){ current = id; return siteDb(id); },
      current: () => current,
      blobUrl: id => sb ? sb.storage.from("files").getPublicUrl(id).data.publicUrl : "",
      async signOut(){ try{ await sb.auth.signOut(); }catch(e){} try{ localStorage.removeItem("curSite"); }catch(e){} location.reload(); },
      async invite(email, role){ const { error } = await sb.from("invites").insert({ site_id: current, email: String(email).trim().toLowerCase(), role }); if (error) throw err("invalid_argument", error.message); },
      async addSite(name, location){ const { data, error } = await sb.rpc("create_site", { p_company: CFG.company, p_name: name, p_location: location || "" }); if (error) throw err("invalid_argument", error.message); await loadSites(); return data; },
    },
  };
})();
