"use client";

import type { Editor } from "@tiptap/react";
import { Loader2, Mic, Pause, Play, ShieldCheck, Square, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MAX_RECORDING_MS, useWhisper, voiceSupport } from "@/hooks/use-whisper";
import { cn } from "@/lib/utils";

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Plain paragraphs from the (possibly edited) transcript. */
const toParagraphs = (text: string) =>
  text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }));

export function RecorderPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const v = useWhisper();
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => setUnsupported(voiceSupport()), []);
  useEffect(() => {
    if (v.status === "review") setHasSelection(!editor.state.selection.empty);
  }, [v.status, editor]);

  const busy = v.status === "recording" || v.status === "paused" || v.status === "transcribing";

  const insert = (mode: "cursor" | "replace") => {
    const nodes = toParagraphs(v.transcript);
    if (!nodes.length) return;
    const chain = editor.chain().focus();
    if (mode === "replace") chain.insertContentAt({ from: editor.state.selection.from, to: editor.state.selection.to }, nodes).run();
    else chain.insertContent(nodes).run();
    v.reset();
  };

  return (
    <section aria-label="Voice recorder" data-no-print className="mb-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        {v.status === "recording" || v.status === "paused" ? (
          <>
            <span className={cn("flex items-center gap-2 text-sm font-medium tabular-nums", v.status === "recording" && "text-destructive")} aria-live="polite">
              <span className={cn("h-2.5 w-2.5 rounded-full", v.status === "recording" ? "animate-pulse bg-destructive" : "bg-muted-foreground")} />
              {v.status === "paused" ? "Paused" : "Recording"} {clock(v.elapsed)}
              <span className="text-xs font-normal text-muted-foreground">/ {clock(MAX_RECORDING_MS)} max</span>
            </span>
            <div className="flex gap-1.5">
              {v.status === "recording" ? (
                <Button size="sm" variant="outline" onClick={v.pause}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={v.resume}>
                  <Play className="h-4 w-4" /> Resume
                </Button>
              )}
              <Button size="sm" onClick={v.stop}>
                <Square className="h-3.5 w-3.5 fill-current" /> Stop & transcribe
              </Button>
              <Button size="sm" variant="ghost" onClick={v.discard} aria-label="Discard recording">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : v.status === "transcribing" ? (
          <span className="flex items-center gap-2 text-sm" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            {v.modelProgress !== null ? `Downloading speech model… ${v.modelProgress}%` : "Transcribing on this device…"}
          </span>
        ) : (
          <>
            <Button size="sm" onClick={v.start} disabled={!!unsupported}>
              <Mic className="h-4 w-4" /> Start recording
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Audio stays on this device. First use downloads a ~40 MB model.
            </p>
          </>
        )}

        {!busy && (
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1.5 hover:bg-accent" aria-label="Close recorder">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(v.status === "recording" || v.status === "paused") && v.modelProgress !== null && (
        <p className="mt-2 text-xs text-muted-foreground">Preparing speech model in the background: {v.modelProgress}%</p>
      )}
      {busy && (v.liveText || v.modelReady) && (
        <div className="mt-3 rounded-md border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Live transcript {v.status === "transcribing" ? "· finalising…" : "· preview, refreshes every few seconds"}
          </p>
          <p aria-live="polite" className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">
            {v.liveText || <span className="text-muted-foreground">Listening… start speaking.</span>}
            {v.status === "recording" && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />}
          </p>
        </div>
      )}
      {(unsupported || v.error) && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {unsupported ?? v.error}
        </p>
      )}

      <Modal
        open={v.status === "review"}
        onClose={v.discard}
        title="Review transcript"
        description="Edit the text before adding it. Nothing is inserted until you choose."
        footer={
          <>
            <Button variant="ghost" onClick={v.discard}>
              Discard
            </Button>
            {hasSelection && (
              <Button variant="outline" onClick={() => insert("replace")} disabled={!v.transcript.trim()}>
                Replace selection
              </Button>
            )}
            <Button onClick={() => insert("cursor")} disabled={!v.transcript.trim()}>
              Insert at cursor
            </Button>
          </>
        }
      >
        <Textarea
          value={v.transcript}
          onChange={(e) => v.setTranscript(e.target.value)}
          className="min-h-48"
          aria-label="Transcript"
        />
        <p className="mt-2 text-xs text-muted-foreground">Recorded {clock(v.elapsed)}. Automatic transcription can mishear names and technical terms.</p>
      </Modal>
    </section>
  );
}
