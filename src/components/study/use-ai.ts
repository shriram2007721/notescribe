"use client";

import { useCallback, useRef, useState } from "react";
import { AIError, httpProvider, runAI, type AIResult } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import type { AIRequest } from "@/lib/ai/prompts";

const MIN_GAP_MS = 2_000; // client-side courtesy limit between requests

export type AIState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: AIResult; request: AIRequest }
  | { status: "error"; error: AIError; request: AIRequest };

/** Runs an AI task with loading/error state, cancellation and a short cooldown between requests. */
export function useAI() {
  const [state, setState] = useState<AIState>({ status: "idle" });
  const ctrl = useRef<AbortController | null>(null);
  const last = useRef(0);

  const run = useCallback(async (req: AIRequest) => {
    const wait = last.current + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last.current = Date.now();

    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ status: "loading" });
    try {
      const { url, consent } = await getAIConfig();
      if (!consent) throw new AIError("not-configured", "Agree to the AI data notice first.");
      const result = await runAI(httpProvider(url), req, c.signal);
      if (!c.signal.aborted) setState({ status: "done", result, request: req });
    } catch (err) {
      if (c.signal.aborted) return;
      const error = err instanceof AIError ? err : new AIError("server", err instanceof Error ? err.message : "Unknown error");
      setState({ status: "error", error, request: req });
    }
  }, []);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, run, cancel, reset: cancel };
}
