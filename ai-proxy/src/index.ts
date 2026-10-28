/**
 * NoteScribe AI proxy: a Cloudflare Worker (free plan) that keeps the Gemini API key server-side.
 *
 * POST /v1/generate  body: AIRequest (see src/lib/ai/prompts.ts)  ->  { text }
 *
 * Safety:
 *  - Only whitelisted study tasks; the prompt is built here, so the proxy can't relay arbitrary prompts.
 *  - Request size limit, input validation, CORS allow-list, upstream timeout.
 *  - Best-effort per-IP rate limit (in-memory, per Worker instance). For stricter limits, add a
 *    Cloudflare Rate Limiting rule on the route.
 *  - Request bodies (note text) are never logged.
 */
import { aiRequestSchema, buildPrompt } from "../../src/lib/ai/prompts";

export interface Env {
  GEMINI_API_KEY: string;
  /** Comma-separated origins allowed to call the proxy, e.g. "https://you.github.io,http://localhost:3000". */
  ALLOWED_ORIGINS: string;
  GEMINI_MODEL?: string;
  RATE_LIMIT_PER_10_MIN?: string;
}

const MAX_BODY_BYTES = 200_000;
const UPSTREAM_TIMEOUT_MS = 45_000;
const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function rateLimited(ip: string, limit: number) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  h.count++;
  return h.count > limit;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const headers = cors(origin, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
    if (url.pathname === "/health") return json(200, { ok: true, configured: Boolean(env.GEMINI_API_KEY) }, headers);
    if (url.pathname !== "/v1/generate" || request.method !== "POST") return json(404, { message: "Not found" }, headers);
    if (!headers["Access-Control-Allow-Origin"]) return json(403, { message: "Origin not allowed. Add it to ALLOWED_ORIGINS." }, headers);
    if (!env.GEMINI_API_KEY) return json(500, { message: "The proxy has no GEMINI_API_KEY secret configured." }, headers);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (rateLimited(ip, Number(env.RATE_LIMIT_PER_10_MIN ?? 30))) return json(429, { message: "Rate limit reached. Try again in a few minutes." }, headers);

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { message: "Request too large. Select a smaller section of your notes." }, headers);

    let prompt;
    try {
      const parsed = aiRequestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return json(400, { message: parsed.error.issues[0]?.message ?? "Invalid request." }, headers);
      prompt = buildPrompt(parsed.data);
    } catch (err) {
      return json(400, { message: err instanceof Error ? err.message : "Invalid request." }, headers);
    }

    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: "user", parts: [{ text: prompt.user }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
            responseMimeType: prompt.json ? "application/json" : "text/plain",
          },
        }),
      });
      if (upstream.status === 429) return json(429, { message: "The AI provider's free quota is exhausted for now. Try again later." }, headers);
      if (!upstream.ok) return json(502, { message: `AI provider error (HTTP ${upstream.status}).` }, headers);

      const data = (await upstream.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) {
        const reason = candidate?.finishReason ? ` (${candidate.finishReason})` : "";
        return json(502, { message: `The AI returned no content${reason}.` }, headers);
      }
      return json(200, { text }, headers);
    } catch {
      return json(504, { message: ctrl.signal.aborted ? "The AI provider timed out." : "Couldn't reach the AI provider." }, headers);
    } finally {
      clearTimeout(timer);
    }
  },
};
