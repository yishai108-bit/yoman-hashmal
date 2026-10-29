// Shared helpers for the API routes. Every route is PIN-protected.
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
export function checkPin(req, res) {
  const want = process.env.SITE_PIN;
  if (!want) { json(res, 503, { error: "not_configured", what: "SITE_PIN" }); return false; }
  const got = req.headers["x-pin"];
  if (got !== want) { json(res, 401, { error: "bad_pin" }); return false; }
  return true;
}
export async function readBody(req, limitBytes = 25 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error("too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function readJson(req) {
  const buf = await readBody(req, 8 * 1024 * 1024);
  return buf.length ? JSON.parse(buf.toString("utf8")) : {};
}
export const COLLECTIONS = new Set(["deliveries", "panels", "moves", "counts", "imports"]);
export function safeId(s) { return /^[A-Za-z0-9_\-.]{1,120}$/.test(String(s)) ? String(s) : null; }
