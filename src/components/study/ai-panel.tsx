"use client";

import type { Editor } from "@tiptap/react";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { useAllNotes } from "@/hooks/use-data";
import { noteToSourceText } from "@/lib/ai/config";
import { MAX_SOURCE_CHARS, TASK_LABELS, type AIRequest, type AITask } from "@/lib/ai/prompts";
import type { Note } from "@/lib/db";
import { AIGate } from "./ai-gate";
import { AIResultView } from "./ai-result";
import { useAI } from "./use-ai";

const PANEL_TASKS: AITask[] = ["summarize", "explain", "stepByStep", "revision", "examQuestions", "qa", "mcq", "flashcards", "gaps", "compare", "ask"];

/** AI study actions for one note, shown beside the editor. */
export function AIPanel({ note, editor }: { note: Note; editor: Editor }) {
  const { state, run, reset } = useAI();
  const notes = useAllNotes();
  const [task, setTask] = useState<AITask>("summarize");
  const [length, setLength] = useState<"short" | "detailed">("short");
  const [level, setLevel] = useState<"beginner" | "advanced">("beginner");
  const [mode, setMode] = useState<"quick" | "comprehensive">("quick");
  const [scope, setScope] = useState<"note" | "selection">("note");
  const [compareWith, setCompareWith] = useState("");
  const [question, setQuestion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const others = useMemo(() => (notes ?? []).filter((n) => n.id !== note.id && n.deletedAt === undefined), [notes, note.id]);
  const titles = useMemo(() => Object.fromEntries((notes ?? []).map((n) => [n.id, n.title || "Untitled note"])), [notes]);

  const build = (): AIRequest | null => {
    setFormError(null);
    const { from, to, empty } = editor.state.selection;
    let text: string;
    if (scope === "selection") {
      if (empty) {
        setFormError("Select some text in the note first, or choose “Whole note”.");
        return null;
      }
      text = editor.state.doc.textBetween(from, to, "\n").trim();
    } else {
      text = noteToSourceText({ content: editor.getJSON() });
    }
    if (!text) {
      setFormError("This note is empty. Write or dictate something first.");
      return null;
    }
    const sources = [{ id: note.id, title: note.title || "Untitled note", text }];
    if (task === "compare") {
      const other = others.find((n) => n.id === compareWith);
      if (!other) {
        setFormError("Choose a note to compare with.");
        return null;
      }
      sources.push({ id: other.id, title: other.title || "Untitled note", text: noteToSourceText(other) });
    }
    if (task === "ask" && !question.trim()) {
      setFormError("Type a question.");
      return null;
    }
    const total = sources.reduce((n, s) => n + s.text.length, 0);
    if (total > MAX_SOURCE_CHARS) {
      setFormError(`That's ${total.toLocaleString()} characters; the limit is ${MAX_SOURCE_CHARS.toLocaleString()}. Select a section instead.`);
      return null;
    }
    return { task, options: { length, level, mode }, sources, scope, question: task === "ask" ? question : undefined };
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const req = build();
    if (req) run(req);
  };

  return (
    <AIGate>
      <div className="space-y-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-task">Action</Label>
            <Select id="ai-task" value={task} onChange={(e) => setTask(e.target.value as AITask)}>
              {PANEL_TASKS.map((t) => (
                <option key={t} value={t}>
                  {TASK_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          {task === "compare" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-compare">Compare with</Label>
              <Select id="ai-compare" value={compareWith} onChange={(e) => setCompareWith(e.target.value)}>
                <option value="">Choose a note…</option>
                {others.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || "Untitled note"}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {task === "ask" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-question">Your question</Label>
              <Textarea id="ai-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} className="min-h-16" />
            </div>
          )}

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Options</legend>
            <Select aria-label="Length" value={length} onChange={(e) => setLength(e.target.value as typeof length)}>
              <option value="short">Short</option>
              <option value="detailed">Detailed</option>
            </Select>
            <Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              <option value="beginner">Beginner-friendly</option>
              <option value="advanced">Advanced</option>
            </Select>
            <Select aria-label="Study mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="quick">Quick revision</option>
              <option value="comprehensive">Comprehensive</option>
            </Select>
            <Select aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="note">Whole note</option>
              <option value="selection">Selected text</option>
            </Select>
          </fieldset>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={state.status === "loading"}>
            <Sparkles className="h-4 w-4" /> {state.status === "loading" ? "Working…" : TASK_LABELS[task]}
          </Button>
        </form>

        <AIResultView
          state={state}
          onRegenerate={() => (state.status === "done" || state.status === "error" ? run(state.request) : submit())}
          onDiscard={reset}
          editor={editor}
          context={{ title: note.title || "Untitled note", noteIds: [note.id], folderId: note.folderId }}
          sourceTitles={titles}
        />
      </div>
    </AIGate>
  );
}
