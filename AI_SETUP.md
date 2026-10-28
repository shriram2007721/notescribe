# Setting up the AI assistant

NoteScribe is a static site, so it has no server to keep secrets on. Putting an AI API key in the
browser would let anyone copy it. Instead, the app talks to a tiny **proxy** you deploy yourself:

```
Browser (NoteScribe) ──note text + task──▶ AI proxy (Cloudflare Worker, holds GEMINI_API_KEY) ──▶ Google Gemini
```

- The proxy only accepts NoteScribe's study tasks and builds the prompt itself (it can't be used as a general chatbot relay).
- It checks the request origin (CORS allow-list), limits request size, rate-limits per IP, and never logs note text.
- The browser stores only the proxy **URL**, which is not a secret.
- Nothing is sent until the user agrees to the data notice and clicks an AI action.

Cost: Cloudflare Workers' free plan and Gemini's free API tier need **no credit card**. Free-tier quotas apply.

## 1. Get a Gemini API key
1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key** and copy it. Keep it private.

## 2. Deploy the proxy (Cloudflare Workers, free)
```bash
npm ci                         # at the repo root (the proxy reuses src/lib/ai/prompts.ts and zod)
cd ai-proxy
npm install
npx wrangler login             # opens the browser; create a free Cloudflare account if needed
npx wrangler secret put GEMINI_API_KEY    # paste the key when asked
```
Edit `ai-proxy/wrangler.toml` so `ALLOWED_ORIGINS` lists where your app runs, for example:
```toml
ALLOWED_ORIGINS = "https://<your-username>.github.io,http://localhost:3000"
```
Then:
```bash
npx wrangler deploy
```
Wrangler prints a URL like `https://notescribe-ai-proxy.<you>.workers.dev`.
Check it: open `<url>/health`. It should show `{"ok":true,"configured":true}`.

## 3. Connect the app
- In NoteScribe: **Settings → AI assistant**, paste the URL, **Save**, then **Test**.
- Optional default for everyone using your deployment: set the GitHub Actions **variable**
  (not secret) `NEXT_PUBLIC_AI_PROXY_URL` under *Settings → Secrets and variables → Actions → Variables*.
  For local builds, copy `.env.example` to `.env.local`.

## Local development of the proxy
```bash
cd ai-proxy
cp .dev.vars.example .dev.vars   # put your key in .dev.vars (git-ignored)
npm run dev                      # http://localhost:8787
```
Then set the app's AI proxy URL to `http://localhost:8787`.

## Environment variables

| Where | Name | Secret? | Purpose |
|---|---|---|---|
| Proxy (Wrangler secret) | `GEMINI_API_KEY` | **Yes** | Gemini API key |
| Proxy (`wrangler.toml`) | `ALLOWED_ORIGINS` | No | Comma-separated origins allowed to call the proxy |
| Proxy (`wrangler.toml`) | `GEMINI_MODEL` | No | Model name, default `gemini-2.5-flash` |
| Proxy (`wrangler.toml`) | `RATE_LIMIT_PER_10_MIN` | No | Requests per IP per 10 minutes (default 30) |
| Web app (build) | `NEXT_PUBLIC_AI_PROXY_URL` | No | Default proxy URL (users can override in Settings) |
| Web app (build) | `NEXT_PUBLIC_BASE_PATH` | No | Sub-path hosting, set automatically for GitHub Pages |

Never put a key in a `NEXT_PUBLIC_*` variable: those are compiled into the public JavaScript.

## Limitations
- The rate limit is per Worker instance (best effort). For hard limits, add a Cloudflare Rate Limiting rule.
- Model output can be wrong. The app labels AI content, keeps it editable, never overwrites notes automatically,
  validates structured output, and checks citation quotes against your notes.
