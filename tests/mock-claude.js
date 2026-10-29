// מדמה את window.claude של ה-artifact לבדיקות: מאגר בזיכרון, משתמש, ובלי AI.
// הגדרות דרך window.__MOCK__ לפני טעינת הדף:
//   role: "owner" | "editor" | "viewer"   (ברירת מחדל owner)
//   seed: { "<collection>": { "<id>": {...} }, "settings": {...} }
//   noClaude: true      → אין window.claude בכלל (תצוגה מקומית)
//   noDb: true          → use("db") מחזיר null
//   killListeners: ms   → אחרי ms כל ההאזנות מקבלות שגיאה סופנית (unavailable)
//   sample: {...}       → use("sample") מחזיר פונקציה שעונה תמיד ב-JSON הזה (הקריאות נאספות ב-window.__MOCK_SAMPLE_CALLS__)
// קבצים שהאפליקציה שומרת דרך downloads נאספים ב-window.__MOCK_SAVED__ ({filename, data})
(function(){
  const M = window.__MOCK__ || {};
  if (M.noClaude) return;
  const role = M.role || "owner";
  const store = new Map();               // path -> body
  const subs = new Set();                // {kind, path, next, error, q}
  const writes = [];                     // יומן כתיבות לבדיקות
  const saved = [];                      // קבצים שנשמרו דרך downloads
  window.__MOCK_STORE__ = store; window.__MOCK_WRITES__ = writes; window.__MOCK_SAVED__ = saved;
  for (const [coll, docs] of Object.entries(M.seed || {}))
    for (const [id, body] of Object.entries(docs)) store.set(coll + "/" + id, JSON.parse(JSON.stringify(body)));

  const err = (code, message) => Object.assign(new Error(message || code), { code });
  const canWrite = path => {
    if (role === "viewer") return false;
    if (path.startsWith("settings/") && role !== "owner") return false;
    return true;
  };
  const canRead = path => !(path === "settings/cba" && role !== "owner");
  const snapDoc = (path) => {
    const body = canRead(path) ? store.get(path) : undefined;
    return { id: path.split("/").pop(), exists: body !== undefined,
      data: () => body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
      metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const runQuery = q => {
    let docs = [...store.keys()].filter(p => p.startsWith(q.coll + "/") && p.split("/").length === q.coll.split("/").length + 1)
      .filter(canRead).sort().map(snapDoc);
    for (const [f, op, v] of q.where) docs = docs.filter(d => {
      const x = d.data()[f];
      return op === "==" ? x === v : op === "!=" ? x !== v : op === "<" ? x < v : op === "<=" ? x <= v
        : op === ">" ? x > v : op === ">=" ? x >= v : op === "in" ? v.includes(x) : true; });
    if (q.order) docs.sort((a, b) => { const x = a.data()[q.order[0]], y = b.data()[q.order[0]];
      const c = x < y ? -1 : x > y ? 1 : 0; return q.order[1] === "desc" ? -c : c; });
    if (q.lim) docs = docs.slice(0, q.lim);
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const notify = () => setTimeout(() => subs.forEach(s => {
    if (s.dead) return;
    s.kind === "doc" ? s.next(snapDoc(s.path)) : s.next(runQuery(s.q));
  }), 0);
  const merge = (a, b) => { const o = { ...(a || {}) };
    for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? merge(o[k], v) : v;
    return o; };
  const docRef = path => ({
    id: path.split("/").pop(), path,
    async get(){ return snapDoc(path); },
    async set(data){ if (!canWrite(path)) throw err("invalid_argument", "rules"); store.set(path, JSON.parse(JSON.stringify(data))); writes.push(["set", path]); notify(); },
    async update(data){ if (!canWrite(path)) throw err("invalid_argument", "rules"); if (!store.has(path)) throw err("invalid_argument", "missing");
      store.set(path, merge(store.get(path), JSON.parse(JSON.stringify(data)))); writes.push(["update", path]); notify(); },
    async delete(){ if (!canWrite(path)) throw err("invalid_argument", "rules"); store.delete(path); writes.push(["delete", path]); notify(); },
    onSnapshot(next, error){ const s = { kind: "doc", path, next, error }; subs.add(s); setTimeout(() => !s.dead && next(snapDoc(path)), 0); return () => { s.dead = true; subs.delete(s); }; },
    collection: p => collRef(path + "/" + p),
  });
  const query = q => ({
    where: (f, op, v) => query({ ...q, where: [...q.where, [f, op, v]] }),
    orderBy: (f, d) => query({ ...q, order: [f, d || "asc"] }),
    limit: n => query({ ...q, lim: n }),
    async get(){ return runQuery(q); },
    onSnapshot(next, error){ const s = { kind: "q", q, next, error }; subs.add(s); setTimeout(() => !s.dead && next(runQuery(q)), 0); return () => { s.dead = true; subs.delete(s); }; },
  });
  const collRef = coll => Object.assign(query({ coll, where: [], order: null, lim: 0 }), {
    path: coll, doc: id => docRef(coll + "/" + (id || Math.random().toString(36).slice(2))),
    async add(data){ const r = docRef(coll + "/" + Math.random().toString(36).slice(2)); await r.set(data); return r; },
  });
  const db = { doc: docRef, collection: collRef };
  if (M.killListeners) setTimeout(() => subs.forEach(s => { s.dead = true; s.error && s.error(err("unavailable", "bridge")); }), M.killListeners);
  window.__MOCK_KILL__ = () => subs.forEach(s => { s.dead = true; s.error && s.error(err("unavailable", "bridge")); });

  const user = {
    isOwner: async () => role === "owner", canEdit: async () => role !== "viewer",
    id: async () => "u_test" + role, me: async () => ({ id: "u_test" + role, name: "בודק " + role, avatarUrl: "", isOwner: role === "owner", canEdit: role !== "viewer" }),
    profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: "בודק" }])), search: async () => [],
  };
  window.claude = { use: async name => {
    if (name === "db") return M.noDb ? null : db;
    if (name === "user") return user;
    if (name === "downloads") return { save: async f => { saved.push(f); } };
    if (name === "sample" && M.sample) {
      const calls = (window.__MOCK_SAMPLE_CALLS__ = window.__MOCK_SAMPLE_CALLS__ || []);
      const fn = async (input, opts) => { calls.push({ input, images: opts && opts.images ? [].concat(opts.images).length : 0 }); return { text: JSON.stringify(M.sample), truncated: false }; };
      fn.json = async (input, opts) => { await fn(input, opts); return JSON.parse(JSON.stringify(M.sample)); };
      fn.limits = async () => ({ images: true });
      return fn;
    }
    return null;   // assets, sample בלי הגדרה: לא בבדיקות
  } };
})();
