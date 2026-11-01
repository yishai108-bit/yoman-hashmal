// קריאת מסמכים עם Claude לאפליקציה העצמאית (תעודות משלוח, מדבקות, כתבי כמויות, תוכניות, דיבור).
// מפתח ה-API יושב רק כאן, כסוד של Supabase (ANTHROPIC_API_KEY), ולא מגיע לטלפון.
// רק משתמש מחובר שהוא חבר באתר כלשהו יכול לקרוא לפונקציה.
// פריסה: supabase secrets set ANTHROPIC_API_KEY=...  ואז  supabase functions deploy sample
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// אפשר להחליף מודל בלי לפרוס מחדש: supabase secrets set SAMPLE_MODEL=claude-haiku-5-5 (זול בערך פי 40; לבדוק קודם על תעודות אמיתיות)
const MODEL = Deno.env.get("SAMPLE_MODEL") || "claude-opus-5-5";
const MAX_IMAGES = 6;
const MAX_B64 = 7_000_000; // ~5MB לתמונה
const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // מי קורא: משתמש מחובר שחבר באתר אחד לפחות
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json({ error: "auth" }, 401);
  const { data: mem } = await sb.from("members").select("site_id").eq("user_id", u.user.id).limit(1);
  if (!mem || !mem.length) return json({ error: "member" }, 403);

  let body: { ping?: boolean; prompt?: string; images?: { media_type: string; data: string }[] };
  try { body = await req.json(); } catch { return json({ error: "body" }, 400); }

  // בדיקת זמינות: האפליקציה מדליקה את הקריאה האוטומטית רק אם יש מפתח
  if (body.ping) return json({ ok: !!anthropic, images: anthropic ? MAX_IMAGES : 0 });
  if (!anthropic) return json({ error: "no-key" }, 503);

  const prompt = String(body.prompt || "").slice(0, 60_000);
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!prompt) return json({ error: "prompt" }, 400);
  for (const im of images) {
    if (!IMG_TYPES.has(im.media_type) || typeof im.data !== "string" || im.data.length > MAX_B64) return json({ error: "image" }, 400);
  }

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map((im) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: im.media_type as "image/jpeg", data: im.data },
    })),
    { type: "text", text: prompt },
  ];

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" }, // חילוץ שורות ממסמך: לא צריך חשיבה עמוקה
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") return json({ error: "refusal" }, 422);
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return json({ text, truncated: res.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "key" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: "api", status: e.status }, 502);
    return json({ error: "net" }, 502);
  }
});
