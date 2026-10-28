import { z } from "zod";
import { quizSchema, type QuestionData } from "../quiz";
import { aiRequestSchema, JSON_TASKS, type AIRequest, type AITask } from "./prompts";

/* ------------------------------------------------------------------ */
/* Provider interface: swap the HTTP proxy for another backend later. */
/* ------------------------------------------------------------------ */

export type AIErrorKind =
  | "not-configured"
  | "offline"
  | "network"
  | "timeout"
  | "rate-limited"
  | "bad-request"
  | "server"
  | "invalid-response";

export class AIError extends Error {
  constructor(
    public kind: AIErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export interface AIProvider {
  /** Returns the model's raw text for a validated request. */
  complete(req: AIRequest, signal?: AbortSignal): Promise<string>;
}

export const AI_TIMEOUT_MS = 60_000;

/** Talks to the NoteScribe AI proxy (see ai-proxy/). The proxy holds the provider key, never the browser. */
export function httpProvider(url: string, { timeoutMs = AI_TIMEOUT_MS, fetchImpl = fetch } = {}): AIProvider {
  return {
    async complete(req, signal) {
      if (!url) throw new AIError("not-configured", "The AI assistant isn't set up. Add your AI proxy URL in Settings.");
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new AIError("offline", "You're offline. AI features need an internet connection; your notes still work.");
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
      signal?.addEventListener("abort", () => ctrl.abort(signal.reason));

      let res: Response;
      try {
        res = await fetchImpl(url.replace(/\/+$/, "") + "/v1/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
          signal: ctrl.signal,
        });
      } catch (err) {
        if (ctrl.signal.aborted && !signal?.aborted) throw new AIError("timeout", "The AI service took too long to respond. Try again or use a shorter section.");
        if (signal?.aborted) throw new AIError("network", "Request cancelled.");
        throw new AIError("network", `Couldn't reach the AI service (${err instanceof Error ? err.message : "network error"}).`);
      } finally {
        clearTimeout(timer);
      }

      const body = (await res.json().catch(() => null)) as { text?: unknown; message?: unknown } | null;
      if (!res.ok) {
        const msg = typeof body?.message === "string" ? body.message : `HTTP ${res.status}`;
        if (res.status === 429) throw new AIError("rate-limited", "Too many AI requests. Wait a minute and try again.");
        if (res.status >= 400 && res.status < 500) throw new AIError("bad-request", msg);
        throw new AIError("server", `The AI service failed: ${msg}`);
      }
      if (typeof body?.text !== "string" || !body.text.trim()) throw new AIError("invalid-response", "The AI service returned an empty response.");
      return body.text;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Typed, validated results                                           */
/* ------------------------------------------------------------------ */

const flashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string().trim().min(1).max(2000), back: z.string().trim().min(1).max(2000) })).min(1).max(50),
});

const answerSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(z.object({ noteId: z.string(), quote: z.string() })).default([]),
  additional: z.string().default(""),
  insufficient: z.boolean().default(false),
});

export interface Citation {
  noteId: string;
  quote: string;
  /** true only if the quote really appears in that note's text (checked locally). */
  verified: boolean;
}

export type AIResult =
  | { kind: "text"; markdown: string }
  | { kind: "flashcards"; cards: { front: string; back: string }[] }
  | { kind: "quiz"; questions: QuestionData[] }
  | { kind: "answer"; answer: string; citations: Citation[]; additional: string; insufficient: boolean };

function parseJSON(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AIError("invalid-response", "The AI returned something that isn't valid JSON. Try Regenerate.");
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Parses and validates a raw model response for a task. Never trusts the model's structure. */
export function parseResult(task: AITask, text: string, sources: AIRequest["sources"]): AIResult {
  if (!JSON_TASKS.has(task)) return { kind: "text", markdown: text.trim() };
  const raw = parseJSON(text);

  if (task === "flashcards") {
    const r = flashcardsSchema.safeParse(raw);
    if (!r.success) throw new AIError("invalid-response", "The AI's flashcards were in an unexpected format. Try Regenerate.");
    return { kind: "flashcards", cards: r.data.cards };
  }
  if (task === "mcq") {
    const r = quizSchema.safeParse(raw);
    if (!r.success) throw new AIError("invalid-response", "The AI's quiz was in an unexpected format. Try Regenerate.");
    return { kind: "quiz", questions: r.data.questions };
  }
  const r = answerSchema.safeParse(raw);
  if (!r.success) throw new AIError("invalid-response", "The AI's answer was in an unexpected format. Try Regenerate.");
  const byId = new Map(sources.map((s) => [s.id, norm(s.text)]));
  return {
    kind: "answer",
    answer: r.data.answer,
    additional: r.data.additional,
    insufficient: r.data.insufficient,
    citations: r.data.citations
      .filter((c) => c.quote.trim())
      .map((c) => ({ ...c, verified: Boolean(byId.get(c.noteId)?.includes(norm(c.quote))) })),
  };
}

export async function runAI(provider: AIProvider, req: AIRequest, signal?: AbortSignal): Promise<AIResult> {
  const parsed = aiRequestSchema.safeParse(req);
  if (!parsed.success) throw new AIError("bad-request", parsed.error.issues[0]?.message ?? "Invalid request.");
  const text = await provider.complete(parsed.data, signal);
  return parseResult(parsed.data.task, text, parsed.data.sources);
}
