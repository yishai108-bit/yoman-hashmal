/* אפליקציה עצמאית (בלי Claude): window.claude מדומה על Supabase.
   נכנס לדף רק בבנייה `node tools/build.js --app` (לפני הקוד של האפליקציה), עם window.YOMAN_APP = {url, key, company, name}.
   האפליקציה עצמה לא משתנה: היא מבקשת claude.use("db"|"user"|"assets"|"downloads") כמו ב-artifact, ומקבלת כאן אותו ממשק:
   - db: מסמכים בטבלה docs (site_id, coll, id, data) במקום מאגר ה-artifact; onSnapshot = שאילתה + עדכון בזמן אמת (realtime)
   - user: המשתמש המחובר ותפקידו באתר הפתוח (members)
   - assets: תמונות וחתימות ב-Storage (bucket «files»)
   - downloads: קובץ למכשיר (שיתוף בטלפון, הורדה במחשב)
   - sample (AI): דרך פונקציית השרת «sample» (supabase/functions/sample), שמחזיקה את מפתח Claude. בלי מפתח בשרת: null, והאפליקציה מסתירה את מה שתלוי בו
   כניסה: מייל → קוד בן 6 ספרות במייל (לא קישור: קישור נפתח ב-Safari ולא באפליקציה המותקנת במסך הבית).
   בלי קליטה: כל אוסף שנקרא נשמר במכשיר (IndexedDB), ושמירות נכנסות לתור ונשלחות לבד כשהקליטה חוזרת (ראו «בלי קליטה» למטה).
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
    // קליטה חלשה: בקשה שלא חוזרת נחשבת «אין רשת» אחרי 15 שניות (העלאת תמונה: 90), ולא תוקעת את השמירה
    const tfetch = (u, o) => { const c = new AbortController(), t = setTimeout(() => c.abort(), /\/storage\//.test(String(u)) ? 90000 : 15000);
      if (o && o.signal) o.signal.addEventListener("abort", () => c.abort());
      return fetch(u, { ...(o || {}), signal: c.signal }).finally(() => clearTimeout(t)); };
    sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true }, global: { fetch: tfetch } });
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
  // הסשן השמור במכשיר (supabase-js שומר ב-localStorage, מפתח sb-<פרויקט>-auth-token)
  function storedSession(){
    try{ for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i);
      if (/^sb-.*-auth-token$/.test(k)){ const v = JSON.parse(localStorage.getItem(k)); const ss = v && (v.currentSession || v); if (ss && ss.user && ss.user.id) return ss; } } }catch(e){}
    return null;
  }
  async function signedIn(){
    const s = await client();
    const { data, error } = await s.auth.getSession();
    session = data && data.session;
    // בלי קליטה עם טוקן שפג: החידוש נכשל ברשת, אבל המשתמש כבר מחובר במכשיר. ממשיכים עם השמור; כשהקליטה חוזרת הספרייה מחדשת לבד.
    if (!session && (error || !navigator.onLine)) session = storedSession();
    if (!session) session = await login();
    // הזמנות שחיכו למייל הזה הופכות לחברות באתרים (פונקציה בשרת)
    try{ await s.rpc("claim_invites"); }catch(e){}
    for (;;){
      try{ await loadSites(); break; }
      catch(e){ await new Promise(r => { const el = ui('<h2>אין חיבור</h2><p class="ag-sub">לא הצלחנו להגיע לשרת. בודקים קליטה ומנסים שוב.</p><button class="ag-go" type="button">נסה שוב</button>');
        el.querySelector(".ag-go").onclick = r; addEventListener("online", r, { once: true }); }); }
    }
    const g = document.getElementById("appGate"); if (g) g.remove();
    return session;
  }
  async function loadSites(){
    const s = await client();
    let [{ data: rows, error: e1 }, { data: mem, error: e2 }] = await Promise.all([
      s.from("sites").select("id,slug,name,location,photo,company").eq("company", CFG.company).order("created_at"),
      s.from("members").select("site_id,role").eq("user_id", session.user.id),
    ]);
    // בלי קליטה השאילתה נכשלת: לא להציג «עוד אין לך אתרים» (נשמע כאילו אין הרשאה), אלא מסך «אין חיבור»
    const ck = "appSites|" + CFG.company + "|" + session.user.id;
    if (e1 || e2 || !rows || !mem){
      // בלי קליטה: רשימת האתרים מהפעם האחרונה במכשיר; רק אם אין כזו, מסך «אין חיבור»
      let c = null; try{ c = JSON.parse(localStorage.getItem(ck) || "null"); }catch(e){}
      if (!c) throw err("unavailable", "offline");
      rows = c.rows; mem = c.mem;
    } else { try{ localStorage.setItem(ck, JSON.stringify({ rows, mem })); }catch(e){} }
    roles = {}; (mem || []).forEach(m => { roles[m.site_id] = m.role; });
    sites = (rows || []).filter(r => roles[r.id]).map(r => ({ id: r.id, name: r.name, location: r.location || "", photo: r.photo || "", role: roles[r.id] }));
  }

  /* ---------- בלי קליטה ----------
     כל אוסף / מסמך שנקרא נשמר במכשיר (IndexedDB, «מראה» לכל אתר ואוסף). כל שמירה נכתבת קודם למראה ולתור (outbox),
     ומשם נשלחת לשרת לפי הסדר. אין רשת: השמירה נשארת בתור, האפליקציה ממשיכה לעבוד מהמראה, והתור נשלח לבד כשהקליטה חוזרת
     (אירוע online, כל 20 שניות, וכשהאפליקציה חוזרת למסך). שגיאה אמיתית (הרשאה) לא נשמרת בתור: חוזרת לאפליקציה כמו קודם.
     התנגשויות: כמעט כל רשומה חדשה עם מזהה משלה; שני מכשירים שערכו את אותה רשומה בלי קליטה = השמירה שנשלחה אחרונה קובעת. */
  const NET = e => !!e && (e.net || e.status === 0 || /retryable/i.test(e.name || "")
    || (!e.code && /fetch|network|load failed|abort|timeout|offline/i.test(String(e.message || ""))));
  const idb = (() => {
    let p = null;
    const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open("yoman-app-" + (CFG.company || "x"), 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction("kv", mode), out = fn(t.objectStore("kv"));
      t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }));
    return { get: k => tx("readonly", st => st.get(k)).catch(() => undefined), set: (k, v) => tx("readwrite", st => { st.put(v, k); }).catch(() => {}),
      del: k => tx("readwrite", st => { st.delete(k); }).catch(() => {}), clear: () => tx("readwrite", st => { st.clear(); }).catch(() => {}) };
  })();
  const mirrors = {}, saveT = {};
  const mir = (S, c) => mirrors[S + "|" + c] || (mirrors[S + "|" + c] = idb.get("m|" + S + "|" + c).then(o => new Map(Object.entries(o || {}))));
  const persist = (S, c) => { const k = S + "|" + c; clearTimeout(saveT[k]); saveT[k] = setTimeout(async () => idb.set("m|" + k, Object.fromEntries(await mir(S, c))), 300); };
  let outbox = [], netDown = false, rejected = 0, flushing = null;
  const outboxReady = idb.get("outbox").then(o => { if (Array.isArray(o)) outbox = o.concat(outbox); });
  const saveOutbox = () => idb.set("outbox", outbox);
  const applyPending = (S, c, m) => outbox.forEach(o => { if (o.S === S && o.coll === c){ if (o.op === "set") m.set(o.id, o.data); else if (o.op === "del") m.delete(o.id); } });
  async function send(o){
    let r;
    if (o.op === "set") r = await sb.from("docs").upsert({ site_id: o.S, coll: o.coll, id: o.id, data: o.data });
    else if (o.op === "del") r = await sb.from("docs").delete().eq("site_id", o.S).eq("coll", o.coll).eq("id", o.id);
    else if (o.op === "file"){
      const blob = await idb.get("f|" + o.path); if (!blob) return "ok";
      r = await sb.storage.from("files").upload(o.path, blob, { contentType: o.type || blob.type || "application/octet-stream", upsert: false });
      if (r && r.error && /exist|duplicate/i.test(String(r.error.message || ""))) r = { error: null };   // נשלח כבר בניסיון קודם
      if (!r.error) await idb.del("f|" + o.path);
    }
    const e = r && r.error; if (!e) return "ok"; if (NET(e)) return "net"; return e;
  }
  // שולח את התור לפי הסדר. מחזיר "net" אם עצר כי אין רשת
  function flush(){
    if (flushing) return flushing;
    return (flushing = (async () => {
      await outboxReady; let res = "ok";
      try{
        while (outbox.length && sb){
          const o = outbox[0]; let r; try{ r = await send(o); }catch(e){ r = NET(e) || e instanceof TypeError ? "net" : e; }
          if (r === "net"){ netDown = true; res = "net"; break; }
          netDown = false; outbox.shift();
          if (r !== "ok"){ o.failed = r; rejected++; console.warn("נדחה בשרת", o.coll, o.id, r); if (o.coll) pullAll(o.S, o.coll); }
          else o.done = true;
          await saveOutbox();
        }
        if (!outbox.length && res === "ok") netDown = false;
      } finally { flushing = null; badge(); }
      return res;
    })());
  }
  // מסמך חדש מהשרת מחליף את המראה; ההשמטה של מה שבתור עוד לא נשלח מוחזרת מעליו
  function pullAll(S, coll){ setTimeout(() => subs.forEach(s => { if ((!S || s.site === S) && (!coll || s.coll === coll) && !s.dead) s.pull(); }), 0); }
  function badge(){
    if (!document.body) return;
    let el = document.getElementById("appSync"); const n = outbox.length, off = netDown || !navigator.onLine;
    if (!n && !off && !rejected){ if (el) el.remove(); return; }
    if (!el){ el = document.createElement("button"); el.type = "button"; el.id = "appSync"; el.className = "app-sync"; el.setAttribute("role", "status");
      el.onclick = () => { rejected = 0; flush().then(() => pullAll()); }; document.body.appendChild(el); }
    el.classList.toggle("off", off); el.classList.toggle("bad", !!rejected);
    el.textContent = (off ? "אין קליטה" : n ? "שולח…" : "")
      + (n ? (off ? " · " : " ") + n + (n === 1 ? " שמירה ממתינה" : " שמירות ממתינות") + " לשליחה" : off ? " · עובדים מהנתונים שבמכשיר" : "")
      + (rejected ? (off || n ? " · " : "") + rejected + " נדחו בשרת (הרשאה)" : "");
  }
  const kick = () => { if (outbox.length) flush().then(r => { if (r === "ok") pullAll(); }); else if (netDown){ netDown = false; pullAll(); badge(); } };
  addEventListener("online", () => { netDown = false; kick(); badge(); });
  addEventListener("offline", badge);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") kick(); });
  setInterval(() => { if (outbox.length || netDown) kick(); }, 20000);

  /* ---------- מאגר: אותו ממשק כמו ה-artifact ---------- */
  const subs = new Set(); const channels = {}; const PAGE = 1000;
  const netErr = error => NET(error) ? Object.assign(new Error("offline"), { net: true }) : err("unavailable", error.message);
  function snapDoc(id, data, cache){ return { id, exists: data !== undefined, data: () => clone(data), metadata: { fromCache: !!cache, hasPendingWrites: false } }; }
  function localRows(m, q){
    let rows = [...m.entries()].map(([id, data]) => ({ id, data }));
    const get = (r, f) => f === "ts" ? Number(r.data && r.data.ts) || 0 : r.data && r.data[f];
    for (const [f, op, v] of q.where){
      const w = f === "ts" ? Number(v) : v, S = x => x == null ? null : String(x);
      rows = rows.filter(r => { const x = get(r, f);
        return op === "==" ? S(x) === S(w) : op === "!=" ? S(x) !== S(w) : op === "<" ? x < w : op === "<=" ? x <= w : op === ">" ? x > w : op === ">=" ? x >= w
          : op === "in" ? (w || []).map(S).includes(S(x)) : true; });
    }
    if (q.order){ const [f, d] = q.order; rows.sort((a, b) => { const x = get(a, f), y = get(b, f); return (x < y ? -1 : x > y ? 1 : 0) * (d === "desc" ? -1 : 1); }); }
    return q.lim ? rows.slice(0, q.lim) : rows;
  }
  function siteDb(S){
    const fetchRows = async q => {
      let r = sb.from("docs").select("id,data").eq("site_id", S).eq("coll", q.coll);
      for (const [f, op, v] of q.where){
        const col = f === "ts" ? "ts" : "data->>" + f, val = f === "ts" ? new Date(v).toISOString() : v;
        r = op === "==" ? r.eq(col, val) : op === "!=" ? r.neq(col, val) : op === "<" ? r.lt(col, val) : op === "<=" ? r.lte(col, val)
          : op === ">" ? r.gt(col, val) : op === ">=" ? r.gte(col, val) : op === "in" ? r.in(col, v) : r;
      }
      if (q.order) r = r.order(q.order[0] === "ts" ? "ts" : "data->>" + q.order[0], { ascending: q.order[1] !== "desc" });
      // Supabase מחזיר עד 1000 שורות לבקשה (max rows): בלי limit קוראים בדפים, אחרת אוסף גדול (משיכות, ניפוקים) נחתך בשקט והמלאי מחושב חסר
      if (q.lim){ const { data, error } = await r.limit(q.lim); if (error) throw netErr(error); return data || []; }
      if (!q.order) r = r.order("id");
      let rows = [];
      for (let from = 0; ; from += PAGE){
        const { data, error } = await r.range(from, from + PAGE - 1); if (error) throw netErr(error);
        rows = rows.concat(data || []); if (!data || data.length < PAGE) break;
      }
      return rows;
    };
    const run = async q => {
      await outboxReady; const m = await mir(S, q.coll); let cache = true;
      try{
        const rows = await fetchRows(q);
        if (!q.where.length && !q.lim) m.clear();   // אוסף שלם: המראה = השרת (ומה שבתור מעליו)
        rows.forEach(x => m.set(x.id, x.data)); applyPending(S, q.coll, m); persist(S, q.coll); cache = false;
        if (netDown){ netDown = false; badge(); kick(); }
      }catch(e){ if (!e.net) throw e; if (!netDown){ netDown = true; badge(); } }
      const docs = localRows(m, q).map(x => snapDoc(x.id, x.data, cache));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: cache, hasPendingWrites: outbox.some(o => o.S === S && o.coll === q.coll) } };
    };
    const getDoc = async (coll, id) => {
      await outboxReady; const m = await mir(S, coll); let cache = true;
      try{
        const { data, error } = await sb.from("docs").select("data").eq("site_id", S).eq("coll", coll).eq("id", id).maybeSingle();
        if (error) throw netErr(error);
        if (data) m.set(id, data.data); else m.delete(id); applyPending(S, coll, m); persist(S, coll); cache = false;
      }catch(e){ if (!e.net) throw e; if (!netDown){ netDown = true; badge(); } }
      return snapDoc(id, m.get(id), cache);
    };
    const refresh = coll => pullAll(S, coll);
    const listen = () => {
      if (channels[S] || !sb.channel) return;
      channels[S] = sb.channel("docs-" + S).on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "site_id=eq." + S },
        p => refresh((p.new && p.new.coll) || (p.old && p.old.coll))).subscribe();
    };
    // שמירה: למראה ולתור מיד (האפליקציה רואה אותה גם בלי קליטה), ואז ניסיון שליחה. שגיאה אמיתית חוזרת לאפליקציה.
    const write = async (coll, id, op, data) => {
      await outboxReady; const m = await mir(S, coll);
      if (op === "set") m.set(id, clone(data)); else m.delete(id); persist(S, coll);
      const o = { S, coll, id, op, data: op === "set" ? clone(data) : null, t: Date.now() };
      outbox.push(o); await saveOutbox(); badge(); refresh(coll);
      for (let i = 0; i < 3 && outbox.includes(o); i++) if (await flush() === "net") break;
      if (o.failed){ rejected = Math.max(0, rejected - 1); badge(); const e = o.failed;
        throw err(/permission|policy|rls|42501/i.test((e.message || "") + " " + (e.code || "")) ? "permission_denied" : "invalid_argument", e.message); }
    };
    const split = p => { const a = String(p).split("/"); if (a.length !== 2) throw new TypeError("נתיב מסמך: אוסף/מזהה"); return a; };
    const docRef = path => { const [coll, id] = split(path); return {
      id, path,
      get: () => getDoc(coll, id),
      set: data => write(coll, id, "set", data),
      async update(patch){ const cur = await getDoc(coll, id); if (!cur.exists) throw err("invalid_argument", "missing");
        const merge = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? merge(o[k], v) : v; return o; };
        return write(coll, id, "set", merge(cur.data(), clone(patch))); },
      delete: () => write(coll, id, "del"),
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
    // בלי קליטה התמונה נשמרת במכשיר ונכנסת לתור; הכתובת הציבורית ידועה מראש (לפי הנתיב), ולכן הרשומה נשמרת כבר עכשיו עם הכתובת הסופית
    async upload(blob){
      const id = crypto.randomUUID().replace(/-/g, ""), path = current + "/" + id, type = blob.type || "application/octet-stream";
      const url = sb.storage.from("files").getPublicUrl(path).data.publicUrl, out = { id: path, url, sizeBytes: blob.size, contentType: blob.type };
      let error = null;
      if (!netDown) try{ ({ error } = await sb.storage.from("files").upload(path, blob, { contentType: type, upsert: false })); }catch(e){ error = { message: String(e && e.message || e), net: true }; }
      if (!netDown && !error) return out;
      if (error && !NET(error)) throw err("unavailable", error.message);
      netDown = true; await outboxReady; await idb.set("f|" + path, blob);
      outbox.push({ op: "file", path, type, t: Date.now() }); await saveOutbox(); badge();
      return out;
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

  /* ---------- sample (AI) ---------- */
  const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(blob); });
  async function callSample(payload, signal){
    const c = await client(); if (!c.functions) throw err("unavailable", "no functions");
    const { data, error } = await c.functions.invoke("sample", { body: payload, signal });
    if (error) throw err("unavailable", error.message || "sample");
    return data || {};
  }
  // אותו ממשק כמו ב-artifact: sample(prompt, {images}) → {text, truncated}; sample.json → אובייקט; sample.limits → {images}
  function makeSample(){
    const fn = async (input, opts) => {
      opts = opts || {};
      const imgs = [].concat(opts.images || []).filter(Boolean).slice(0, 6);
      const images = await Promise.all(imgs.map(async b => ({ media_type: /^image\/(jpeg|png|webp|gif)$/.test(b.type) ? b.type : "image/jpeg", data: await b64(b) })));
      const out = await callSample({ prompt: String(input || ""), images }, opts.signal);
      if (out.error) throw err(out.error === "refusal" ? "refused" : "unavailable", out.error);
      return { text: String(out.text || ""), truncated: !!out.truncated };
    };
    fn.json = async (input, opts) => {
      const { text } = await fn(input, opts);
      const t = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      try { return JSON.parse(t); } catch (e) {}
      const a = t.search(/[\[{]/), z = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
      if (a >= 0 && z > a) { try { return JSON.parse(t.slice(a, z + 1)); } catch (e) {} }
      throw err("invalid_json", "no json");
    };
    let lim = null;   // פעם אחת לפתיחה: יש מפתח בשרת או אין
    fn.limits = async () => lim || (lim = callSample({ ping: true }).then(r => r && r.ok ? { images: r.images || 6 } : null, () => { lim = null; return null; }));
    return fn;
  }

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
      if (name === "sample"){ try{ const f = makeSample(); return (await f.limits()) ? f : null; }catch(e){ return null; } }
      return null;
    },
    // לשכבת האתרים (29-sites.js): רשימת האתרים של המשתמש, בחירת אתר, יציאה
    __app: {
      company: CFG.company, name: CFG.name || "",
      sites: () => (sites || []).slice(),
      open(id){ current = id; return siteDb(id); },
      current: () => current,
      blobUrl: id => sb ? sb.storage.from("files").getPublicUrl(id).data.publicUrl : "",
      async signOut(){
        if (outbox.length && !confirm(outbox.length + " שמירות עוד לא נשלחו (אין קליטה). ביציאה הן יימחקו מהמכשיר. לצאת בכל זאת?")) return;
        try{ await sb.auth.signOut(); }catch(e){}
        // הנתונים שבמכשיר שייכים למשתמש הזה: נמחקים ביציאה
        try{ localStorage.removeItem("curSite"); Object.keys(localStorage).filter(k => k.startsWith("appSites|")).forEach(k => localStorage.removeItem(k)); }catch(e){}
        outbox = []; await idb.clear(); location.reload(); },
      pending: () => outbox.length,
      async invite(email, role){ const { error } = await sb.from("invites").insert({ site_id: current, email: String(email).trim().toLowerCase(), role }); if (error) throw err("invalid_argument", error.message); },
      async addSite(name, location){ const { data, error } = await sb.rpc("create_site", { p_company: CFG.company, p_name: name, p_location: location || "" }); if (error) throw err("invalid_argument", error.message); await loadSites(); return data; },
    },
  };
})();
