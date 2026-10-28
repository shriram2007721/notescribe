"use client";

import type { Editor } from "@tiptap/react";
import { AlertTriangle, Check, CheckCircle2, Copy, FilePlus2, Layers, Loader2, RefreshCw, TextCursorInput, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import type { AIResult } from "@/lib/ai/client";
import { addCards } from "@/lib/cards";
import { markdownToHTML, noteFromMarkdown } from "@/lib/markdown";
import { createNote } from "@/lib/notes";
import { withIds } from "@/lib/quiz";
import { QuizRunner } from "./quiz-runner";
import type { AIState } from "./use-ai";

export function AIResultView({
  state,
  onRegenerate,
  onDiscard,
  editor,
  context,
  sourceTitles,
}: {
  state: AIState;
  onRegenerate: () => void;
  onDiscard: () => void;
  /** When present, results can be inserted into this note. */
  editor?: Editor | null;
  context: { title: string; noteIds: string[]; folderId?: string };
  sourceTitles: Record<string, string>;
}) {
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" /> Generating… this usually takes 5–20 seconds.
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> {state.error.message}
        </p>
        <div className="mt-3 flex gap-2">
          {state.error.kind !== "not-configured" && state.error.kind !== "bad-request" && (
            <Button size="sm" variant="outline" onClick={onRegenerate}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          )}
          {state.error.kind === "not-configured" && (
            <Link href="/settings#ai" className="text-sm font-medium text-primary underline">
              Open AI settings
            </Link>
          )}
        </div>
      </div>
    );
  }
  return (
    <ResultBody
      key={JSON.stringify(state.request)}
      result={state.result}
      onRegenerate={onRegenerate}
      onDiscard={onDiscard}
      editor={editor}
      context={context}
      sourceTitles={sourceTitles}
    />
  );
}

function ResultBody({
  result,
  onRegenerate,
  onDiscard,
  editor,
  context,
  sourceTitles,
}: {
  result: AIResult;
  onRegenerate: () => void;
  onDiscard: () => void;
  editor?: Editor | null;
  context: { title: string; noteIds: string[]; folderId?: string };
  sourceTitles: Record<string, string>;
}) {
  const { toast } = useFeedback();
  const router = useRouter();
  const [text, setText] = useState(result.kind === "text" ? result.markdown : result.kind === "answer" ? result.answer : "");
  const [cards, setCards] = useState(result.kind === "flashcards" ? result.cards.map((c) => ({ ...c, keep: true })) : []);
  const [quizStarted, setQuizStarted] = useState(false);

  useEffect(() => {
    if (result.kind === "flashcards") setCards(result.cards.map((c) => ({ ...c, keep: true })));
  }, [result]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard", tone: "success" });
    } catch {
      toast({ title: "Couldn't access the clipboard", tone: "error" });
    }
  };

  const insert = () => {
    if (!editor) return;
    editor.chain().focus().insertContent(markdownToHTML(text)).run();
    toast({ title: "Inserted into your note", tone: "success" });
    onDiscard();
  };

  const newNote = async () => {
    const fields = noteFromMarkdown(text, `${context.title} (AI)`);
    const note = await createNote({ ...fields, folderId: context.folderId });
    toast({ title: "Created a new note", tone: "success", action: { label: "Open", onClick: () => router.push(`/note?id=${note.id}`) } });
  };

  const saveCards = async () => {
    const keep = cards.filter((c) => c.keep && c.front.trim() && c.back.trim());
    if (!keep.length) return;
    await addCards(
      keep.map(({ front, back }) => ({ front, back })),
      { source: "ai", noteId: context.noteIds.length === 1 ? context.noteIds[0] : undefined, folderId: context.folderId },
    );
    toast({ title: `Saved ${keep.length} flashcards`, tone: "success", action: { label: "Review", onClick: () => router.push("/flashcards/review") } });
    onDiscard();
  };

  const actions = (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="ghost" onClick={onRegenerate}>
        <RefreshCw className="h-4 w-4" /> Regenerate
      </Button>
      <Button size="sm" variant="ghost" onClick={onDiscard}>
        <Trash2 className="h-4 w-4" /> Discard
      </Button>
    </div>
  );

  if (result.kind === "flashcards") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Edit or untick cards before saving. Nothing is saved until you click Save.</p>
        <ul className="space-y-2">
          {cards.map((c, i) => (
            <li key={i} className="flex gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                checked={c.keep}
                onChange={(e) => setCards((cs) => cs.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                className="mt-2.5 h-4 w-4 accent-[hsl(var(--primary))]"
                aria-label={`Keep card ${i + 1}`}
              />
              <div className="grid flex-1 gap-1.5">
                <Input value={c.front} onChange={(e) => setCards((cs) => cs.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))} aria-label={`Card ${i + 1} question`} />
                <Textarea
                  value={c.back}
                  onChange={(e) => setCards((cs) => cs.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))}
                  aria-label={`Card ${i + 1} answer`}
                  className="min-h-16"
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={saveCards} disabled={!cards.some((c) => c.keep)}>
            <Layers className="h-4 w-4" /> Save {cards.filter((c) => c.keep).length} flashcards
          </Button>
          {actions}
        </div>
      </div>
    );
  }

  if (result.kind === "quiz") {
    return quizStarted ? (
      <QuizRunner questions={withIds(result.questions)} title={`${context.title} (AI quiz)`} source="ai" noteIds={context.noteIds} onExit={onDiscard} />
    ) : (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm">
          {result.questions.length} questions generated from {context.noteIds.length === 1 ? "this note" : `${context.noteIds.length} notes`}.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={() => setQuizStarted(true)}>Start quiz</Button>
          {actions}
        </div>
      </div>
    );
  }

  if (result.kind === "answer") {
    return (
      <div className="space-y-3">
        {result.insufficient && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Your notes don&apos;t fully cover this question.
          </p>
        )}
        <section aria-label="Answer from your notes">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">From your notes</h4>
          <div className="whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm leading-relaxed">{result.answer}</div>
        </section>
        {result.citations.length > 0 && (
          <section aria-label="Sources">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</h4>
            <ul className="space-y-1.5">
              {result.citations.map((c, i) => (
                <li key={i} className="rounded-md border p-2 text-sm">
                  <p className="flex items-center gap-1.5 text-xs">
                    {c.verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-label="Quote found in note" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label="Quote not found in note" />
                    )}
                    {sourceTitles[c.noteId] ? (
                      <Link href={`/note?id=${c.noteId}`} className="font-medium underline">
                        {sourceTitles[c.noteId]}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown note</span>
                    )}
                    {!c.verified && <span className="text-muted-foreground">· quote not found word-for-word in this note</span>}
                  </p>
                  <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">“{c.quote}”</blockquote>
                </li>
              ))}
            </ul>
          </section>
        )}
        {result.additional.trim() && (
          <section aria-label="Additional explanation">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beyond your notes (AI-generated)</h4>
            <div className="whitespace-pre-wrap rounded-lg border border-dashed p-3 text-sm leading-relaxed">{result.additional}</div>
          </section>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={copy}>
            <Copy className="h-4 w-4" /> Copy answer
          </Button>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">AI-generated. Edit before using it; check it against your notes.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-64 font-mono text-[13px]" aria-label="AI result (editable Markdown)" />
      <div className="flex flex-wrap gap-1.5">
        {editor && (
          <Button size="sm" onClick={insert} disabled={!text.trim()}>
            <TextCursorInput className="h-4 w-4" /> Insert at cursor
          </Button>
        )}
        <Button size="sm" variant={editor ? "outline" : "default"} onClick={newNote} disabled={!text.trim()}>
          <FilePlus2 className="h-4 w-4" /> Save as new note
        </Button>
        <Button size="sm" variant="ghost" onClick={copy}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
        {actions}
      </div>
      {!editor && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Your original notes are never changed automatically.
        </p>
      )}
    </div>
  );
}
