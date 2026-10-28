"use client";

import type { Editor } from "@tiptap/react";
import { Loader2, Mic, Square } from "lucide-react";
import { useWhisper } from "@/hooks/use-whisper";
import { cn } from "@/lib/utils";

export function MicButton({ editor }: { editor: Editor }) {
  const { status, progress, error, start, stop } = useWhisper((text) => {
    editor.chain().focus().insertContent(`${text} `).run();
  });

  const recording = status === "recording";
  const busy = status === "transcribing" || (status === "loading" && !recording);

  let label = "Dictate";
  if (recording) label = progress !== null ? `Stop · model ${progress}%` : "Stop";
  else if (status === "loading") label = progress !== null ? `Loading ${progress}%` : "Loading model…";
  else if (status === "transcribing") label = "Transcribing…";

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="max-w-[16rem] text-xs leading-tight text-destructive">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={busy}
        aria-pressed={recording}
        title="Voice dictation runs on this device. Nothing is uploaded."
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-70",
          recording
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : recording ? (
          <Square className="h-3 w-3 animate-pulse fill-current" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
    </div>
  );
}
