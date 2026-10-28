import { describe, expect, it, vi } from "vitest";
import { AIError, httpProvider, parseResult, runAI, type AIProvider } from "@/lib/ai/client";
import { buildPrompt, MAX_SOURCE_CHARS, type AIRequest } from "@/lib/ai/prompts";

const src = [{ id: "n1", title: "Deadlocks", text: "A deadlock needs four conditions: mutual exclusion, hold and wait, no preemption, circular wait." }];
const req = (over: Partial<AIRequest> = {}): AIRequest => ({ task: "summarize", options: {}, sources: src, ...over }) as AIRequest;
const fake = (text: string): AIProvider => ({ complete: async () => text });

describe("buildPrompt", () => {
  it("includes the note, grounding rules and style options", () => {
    const p = buildPrompt(req({ options: { length: "detailed", level: "advanced", mode: "comprehensive" } }));
    expect(p.json).toBe(false);
    expect(p.user).toContain('<note id="n1" title="Deadlocks">');
    expect(p.user).toContain("circular wait");
    expect(p.system).toContain("Beyond your notes");
    expect(p.system).toContain("advanced");
    expect(p.system).toContain("thorough");
  });

  it("requests JSON for structured tasks and validates task requirements", () => {
    expect(buildPrompt(req({ task: "flashcards" })).json).toBe(true);
    expect(() => buildPrompt(req({ task: "compare" }))).toThrow(/two notes/);
    expect(() => buildPrompt(req({ task: "ask" }))).toThrow(/question/);
  });

  it("rejects oversized input and unknown tasks", () => {
    expect(() => buildPrompt(req({ sources: [{ id: "x", title: "t", text: "a".repeat(MAX_SOURCE_CHARS + 1) }] }))).toThrow(/too long/);
    expect(() => buildPrompt(req({ task: "write-my-essay" as never }))).toThrow();
  });
});

describe("parseResult / runAI", () => {
  it("returns markdown for text tasks", async () => {
    expect(await runAI(fake("  ## Summary\n- a  "), req())).toEqual({ kind: "text", markdown: "## Summary\n- a" });
  });

  it("validates flashcards, tolerating code fences", async () => {
    const r = await runAI(fake('```json\n{"cards":[{"front":"Q","back":"A"}]}\n```'), req({ task: "flashcards" }));
    expect(r).toEqual({ kind: "flashcards", cards: [{ front: "Q", back: "A" }] });
  });

  it("rejects malformed or wrongly-shaped JSON with invalid-response", async () => {
    await expect(runAI(fake("not json"), req({ task: "flashcards" }))).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(runAI(fake('{"cards":[]}'), req({ task: "flashcards" }))).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(
      runAI(fake('{"questions":[{"kind":"mcq","prompt":"x","options":["a","b"],"answerIndex":3}]}'), req({ task: "mcq" })),
    ).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it("marks citations verified only when the quote really appears in the note", () => {
    const r = parseResult(
      "ask",
      JSON.stringify({
        answer: "Four conditions.",
        citations: [
          { noteId: "n1", quote: "hold and  WAIT" },
          { noteId: "n1", quote: "invented sentence" },
          { noteId: "nope", quote: "circular wait" },
        ],
        additional: "",
        insufficient: false,
      }),
      src,
    );
    expect(r.kind).toBe("answer");
    if (r.kind === "answer") expect(r.citations.map((c) => c.verified)).toEqual([true, false, false]);
  });

  it("validates the request before calling the provider", async () => {
    const complete = vi.fn();
    await expect(runAI({ complete }, req({ sources: [] }))).rejects.toBeInstanceOf(AIError);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("httpProvider errors", () => {
  const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("reports a missing configuration instead of pretending to work", async () => {
    await expect(httpProvider("").complete(req())).rejects.toMatchObject({ kind: "not-configured" });
  });

  it("maps HTTP failures to clear error kinds", async () => {
    await expect(httpProvider("https://x", { fetchImpl: respond(429, {}) }).complete(req())).rejects.toMatchObject({ kind: "rate-limited" });
    await expect(httpProvider("https://x", { fetchImpl: respond(400, { message: "bad" }) }).complete(req())).rejects.toMatchObject({
      kind: "bad-request",
      message: "bad",
    });
    await expect(httpProvider("https://x", { fetchImpl: respond(502, { message: "upstream" }) }).complete(req())).rejects.toMatchObject({ kind: "server" });
    await expect(httpProvider("https://x", { fetchImpl: respond(200, { text: "" }) }).complete(req())).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it("returns text and posts to /v1/generate", async () => {
    const f = respond(200, { text: "hello" });
    expect(await httpProvider("https://proxy.example/", { fetchImpl: f }).complete(req())).toBe("hello");
    expect(f).toHaveBeenCalledWith("https://proxy.example/v1/generate", expect.objectContaining({ method: "POST" }));
  });

  it("times out", async () => {
    const hang = vi.fn((_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    await expect(httpProvider("https://x", { fetchImpl: hang as never, timeoutMs: 20 }).complete(req())).rejects.toMatchObject({ kind: "timeout" });
  });

  it("reports network failures", async () => {
    const fail = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(httpProvider("https://x", { fetchImpl: fail }).complete(req())).rejects.toMatchObject({ kind: "network" });
  });
});
