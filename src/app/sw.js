// Service worker של האפליקציה המותקנת: הדף וספריית Supabase נשמרים במכשיר, כדי שהאפליקציה תיפתח גם בקליטה חלשה.
// הנתונים עצמם (Supabase) לא נשמרים כאן: תמיד מהרשת.
const CACHE = "yoman-__VERSION__";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const shell = u.origin === location.origin, lib = u.hostname === "cdn.jsdelivr.net";
  if (!shell && !lib) return;
  // הדף: קודם מהרשת (גרסה חדשה), בלי רשת מהמכשיר. הספרייה: מהמכשיר (הגרסה נעולה בכתובת).
  e.respondWith(shell
    ? fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
    : caches.match(e.request).then(r => r || fetch(e.request).then(x => { const c = x.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return x; })));
});
