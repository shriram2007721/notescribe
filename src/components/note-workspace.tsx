"use client";

import { BubbleMenu, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import { ArrowLeft, Check, Globe, ListFilter, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { HighlightButtons } from "@/components/editor/highlight-buttons";
import { HighlightExtractor } from "@/components/editor/highlight-extractor";
import { MicButton } from "@/components/editor/mic-button";
import { useSmartEditor } from "@/components/editor/use-smart-editor";
import { ShareDialog } from "@/components/share-dialog";
import { Button } from "@/components/ui/button";
import { updateNote, type Note } from "@/lib/db";
import { extractHighlights, tagsIn } from "@/lib/highlights";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 400;

export function NoteWorkspace({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [saved, setSaved] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const pending = useRef<Partial<Note>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flush = async () => {
    clearTimeout(timer.current);
    const changes = pending.current;
    pending.current = {};
    if (Object.keys(changes).length) {
      // Any edit to a published note marks it as needing a re-publish.
      await updateNote(note.id, { ...changes, ...(note.shareId ? { syncStatus: "pending" } : {}) });
      setSaved(true);
    }
  };

  const queueSave = (changes: Partial<Note>) => {
    pending.current = { ...pending.current, ...changes };
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  const editor = useSmartEditor({
    content: note.content as JSONContent,
    onUpdate: (ed: Editor) =>
      queueSave({
        content: ed.getJSON(),
        plainText: ed.getText({ blockSeparator: "\n" }).trim(),
        tags: tagsIn(extractHighlights(ed.state.doc)),
      }),
  });

  // Save whatever is pending when leaving the page.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container py-4">
      <div className="mb-2 flex items-center gap-2">
        <Link href="/" className="rounded-md p-2 hover:bg-accent" aria-label="Back to notes">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queueSave({ title: e.target.value });
          }}
          placeholder="Untitled note"
          aria-label="Note title"
          className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight outline-none sm:text-2xl"
        />
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" /> Saved locally
            </>
          ) : (
            "Saving…"
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
        >
          <ListFilter className="h-4 w-4" /> Highlights
        </Button>
        <Button size="sm" variant={note.shareId ? "secondary" : "default"} onClick={() => setShareOpen(true)}>
          {note.shareId ? <Globe className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {note.shareId ? "Shared" : "Share"}
        </Button>
      </div>

      {editor && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <EditorToolbar editor={editor} trailing={<MicButton editor={editor} />} />
            <BubbleMenu
              editor={editor}
              shouldShow={({ editor: ed, state }) => ed.isEditable && !state.selection.empty}
              className="rounded-lg border bg-popover p-1 shadow-lg"
            >
              <HighlightButtons editor={editor} compact />
            </BubbleMenu>
            <EditorContent editor={editor} />
          </section>

          <HighlightExtractor
            editor={editor}
            className={cn(
              "lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:border-l lg:pl-6",
              panelOpen ? "order-first rounded-xl border p-4 lg:order-none lg:rounded-none lg:border-y-0 lg:border-r-0 lg:p-0 lg:pl-6" : "hidden",
            )}
          />
        </div>
      )}

      <ShareDialog
        note={{ ...note, title }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        beforeShare={flush}
      />
    </main>
  );
}
