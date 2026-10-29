import Anthropic from "@anthropic-ai/sdk";
import { json, checkPin, readJson } from "./_lib.js";

// POST { prompt, image (base64), mime } → the JSON object Claude extracted from the photo.
// Uses Claude Opus 5 with low effort (fast, cheap) and server-side refusal fallbacks.
export default async function handler(req, res) {
  if (!checkPin(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!process.env.ANTHROPIC_API_KEY) return json(res, 503, { error: "not_configured", what: "ANTHROPIC_API_KEY" });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: "bad_json" }); }
  const { prompt, image, mime } = body || {};
  if (!prompt || !image) return json(res, 400, { error: "missing_fields" });
  const media_type = ["image/jpeg", "image/png", "image/webp"].includes(mime) ? mime : "image/jpeg";
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type, data: image } },
          { type: "text", text: String(prompt) + "\nהחזר JSON בלבד, בלי טקסט מסביב." },
        ],
      }],
    });
    if (response.stop_reason === "refusal") return json(res, 422, { error: "refused" });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const parsed = tolerantJson(text);
    if (parsed === undefined) return json(res, 422, { error: "invalid_json", text });
    return json(res, 200, { data: parsed });
  } catch (e) {
    const status = e && e.status;
    if (status === 429) return json(res, 429, { error: "rate_limited" });
    if (status === 401) return json(res, 503, { error: "not_configured", what: "ANTHROPIC_API_KEY (invalid)" });
    return json(res, 502, { error: "read_failed", message: String(e && e.message || e).slice(0, 300) });
  }
}
function tolerantJson(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return undefined;
}
