import { put } from "@vercel/blob";
import { json, checkPin, readBody } from "./_lib.js";
import { randomBytes } from "node:crypto";

// POST raw image bytes (Content-Type image/jpeg|png|webp) → { id, url }
export default async function handler(req, res) {
  if (!checkPin(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json(res, 503, { error: "not_configured", what: "BLOB_READ_WRITE_TOKEN" });
  const type = String(req.headers["content-type"] || "");
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  if (!/^image\/(jpeg|png|webp)/.test(type)) return json(res, 415, { error: "image_only" });
  try {
    const buf = await readBody(req, 20 * 1024 * 1024);
    const id = randomBytes(12).toString("hex");
    const blob = await put(`photos/${id}.${ext}`, buf, { access: "public", contentType: type, addRandomSuffix: false });
    return json(res, 200, { id, url: blob.url, sizeBytes: buf.length, contentType: type });
  } catch (e) {
    return json(res, e.message === "too_large" ? 413 : 500, { error: e.message === "too_large" ? "too_large" : "upload_failed" });
  }
}
