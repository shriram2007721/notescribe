"use client";

import { ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { setAIConsent, useAIConfig } from "@/lib/ai/config";

/**
 * Renders children only when the AI proxy is configured and the user has agreed to the data notice.
 * Otherwise it explains what's needed. No fake responses are ever shown.
 */
export function AIGate({ children }: { children: ReactNode }) {
  const config = useAIConfig();
  if (!config) return null;

  if (!config.url) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> AI assistant not set up
        </p>
        <p className="mt-1 text-muted-foreground">
          AI features need a NoteScribe AI proxy, which keeps the API key off your device. Your notes, flashcards and local quizzes work without it.
        </p>
        <Link href="/settings#ai" className={buttonVariants({ size: "sm", variant: "outline", className: "mt-3" })}>
          Set up in Settings
        </Link>
      </div>
    );
  }

  if (!config.consent) {
    return (
      <div className="rounded-lg border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ShieldAlert className="h-4 w-4 text-primary" /> Before you use AI
        </p>
        <p className="mt-1 text-muted-foreground">
          When you run an AI action, the text of the selected note(s) is sent to your AI proxy at{" "}
          <span className="break-all font-mono text-xs">{config.url}</span>, which forwards it to Google Gemini to generate the result. Nothing
          is sent until you click an action. Results can contain mistakes, so check them against your notes.
        </p>
        <Button size="sm" className="mt-3" onClick={() => setAIConsent(true)}>
          I understand, enable AI
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
