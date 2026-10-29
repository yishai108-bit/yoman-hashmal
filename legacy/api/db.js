import { put, list, del } from "@vercel/blob";
import { json, checkPin, readJson, COLLECTIONS, safeId } from "./_lib.js";

// One blob per document: data/<collection>/<id>.json  (atomic per doc, no lost updates)
export default async function handler(req, res) {
  if (!checkPin(req, res)) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(res, 503, { error: "not_configured", what: "BLOB_READ_WRITE_TOKEN" });
  const url = new URL(req.url, "http://x");
  const c = url.searchParams.get("c") || "";
  if (!COLLECTIONS.has(c)) return json(res, 400, { error: "bad_collection" });
  const prefix = `data/${c}/`;
  try {
    if (req.method === "GET") {
      const docs = [];
      let cursor;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        const bodies = await Promise.all(page.blobs.map(async b => {
          const r = await fetch(b.url, { cache: "no-store" });
          return r.ok ? r.json() : null;
        }));
        bodies.forEach(d => { if (d && d.id) docs.push(d); });
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return json(res, 200, { docs });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      const items = Array.isArray(body.docs) ? body.docs : (body.id ? [{ id: body.id, data: body.data }] : []);
      if (!items.length) return json(res, 400, { error: "empty" });
      const out = [];
      for (const it of items) {
        const id = safeId(it.id); if (!id) continue;
        const data = Object.assign({}, it.data || {}, { id });
        await put(`${prefix}${id}.json`, JSON.stringify(data), {
          access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0,
        });
        out.push(id);
      }
      return json(res, 200, { ok: true, ids: out });
    }
    if (req.method === "DELETE") {
      const id = safeId(url.searchParams.get("id") || "");
      if (!id) return json(res, 400, { error: "bad_id" });
      const page = await list({ prefix: `${prefix}${id}.json`, limit: 5 });
      await Promise.all(page.blobs.filter(b => b.pathname === `${prefix}${id}.json`).map(b => del(b.url)));
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: "method" });
  } catch (e) {
    return json(res, 500, { error: "db_failed", message: String(e && e.message || e) });
  }
}
