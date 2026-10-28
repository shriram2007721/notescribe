"use client";

import { FileText, Highlighter, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { CardEditor } from "@/components/study/card-editor";
import { HighlightCardsDialog } from "@/components/study/highlight-cards-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAllNotes, useCards, useFolders } from "@/hooks/use-data";
import { deleteCard } from "@/lib/cards";
import type { Flashcard, Note } from "@/lib/db";
import { DAY_MS, isDue } from "@/lib/srs";

function dueLabel(card: Flashcard, now: number) {
  if (card.reps === 0 && card.lapses === 0) return "New";
  if (isDue(card, now)) return "Due today";
  const days = Math.ceil((card.due - now) / DAY_MS);
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

export default function FlashcardsPage() {
  const cards = useCards();
  const notes = useAllNotes();
  const folders = useFolders();
  const { confirm, toast } = useFeedback();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [folder, setFolder] = useState("");
  const [editing, setEditing] = useState<Flashcard | "new" | null>(null);
  const [pickNote, setPickNote] = useState(false);
  const [highlightNote, setHighlightNote] = useState<Note | null>(null);

  const now = Date.now();
  const noteById = useMemo(() => new Map((notes ?? []).map((n) => [n.id, n])), [notes]);
  const visible = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return (cards ?? [])
      .filter((c) => !folder || (folder === "none" ? !c.folderId : c.folderId === folder))
      .filter((c) => !q || `${c.front}\n${c.back}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [cards, deferred, folder]);
  const due = (cards ?? []).filter((c) => isDue(c, now)).length;

  const remove = async (c: Flashcard) => {
    if (await confirm({ title: "Delete this flashcard?", description: "Its review history is deleted too.", confirmLabel: "Delete", destructive: true })) {
      await deleteCard(c.id);
      toast({ title: "Flashcard deleted" });
    }
  };

  if (!cards || !folders || !notes) return <div className="px-4 py-10" aria-busy="true" />;
  const activeNotes = notes.filter((n) => n.deletedAt === undefined);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length} cards · {due} due today. Reviews are scheduled with spaced repetition.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPickNote(true)}>
            <Highlighter className="h-4 w-4" /> From highlights
          </Button>
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> New card
          </Button>
          <Link href="/flashcards/review" className={buttonVariants({ className: due ? "" : "pointer-events-none opacity-50" })} aria-disabled={!due}>
            <Layers className="h-4 w-4" /> Review {due ? `${due} due` : ""}
          </Link>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No flashcards yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Make cards from a note&apos;s 📚 💼 💡 highlights, write them yourself, or generate them with the AI assistant in a note.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => setPickNote(true)}>
              <Highlighter className="h-4 w-4" /> From highlights
            </Button>
            <Button variant="outline" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> New card
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1 sm:max-w-xs">
              <span className="sr-only">Search cards</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards" className="h-9 pl-9" type="search" />
            </label>
            <Select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Filter by subject" className="sm:w-56">
              <option value="">All subjects</option>
              <option value="none">No subject</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No cards match.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {visible.map((c) => {
                const source = c.noteId ? noteById.get(c.noteId) : undefined;
                return (
                  <li key={c.id} className="flex gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-sm font-medium">{c.front}</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.back}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">{dueLabel(c, now)}</span>
                        <span>{c.source === "ai" ? "AI-generated" : c.source === "highlight" ? "From highlights" : "Manual"}</span>
                        {source && source.deletedAt === undefined ? (
                          <Link href={`/note?id=${source.id}`} className="inline-flex items-center gap-1 underline">
                            <FileText className="h-3 w-3" /> {source.title || "Untitled note"}
                          </Link>
                        ) : c.noteId || source ? (
                          <span>Source note unavailable</span>
                        ) : null}
                        {c.folderId && <span>{folders.find((f) => f.id === c.folderId)?.name}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-start gap-0.5">
                      <button type="button" onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Edit card">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => remove(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Delete card">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <CardEditor open={editing !== null} onClose={() => setEditing(null)} card={editing && editing !== "new" ? editing : undefined} folders={folders} />

      <NotePicker
        open={pickNote}
        notes={activeNotes.filter((n) => n.tags.length > 0)}
        onClose={() => setPickNote(false)}
        onPick={(n) => {
          setPickNote(false);
          setHighlightNote(n);
        }}
      />
      <HighlightCardsDialog note={highlightNote} open={!!highlightNote} onClose={() => setHighlightNote(null)} />
    </div>
  );
}

function NotePicker({ open, notes, onClose, onPick }: { open: boolean; notes: Note[]; onClose: () => void; onPick: (n: Note) => void }) {
  const [id, setId] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose a note"
      description="Only notes with highlights are listed."
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!id} onClick={() => onPick(notes.find((n) => n.id === id)!)}>
            Continue
          </Button>
        </>
      }
    >
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">None of your notes have highlights yet. Open a note, select text, and tag it 📚 💼 or 💡.</p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="pick-note">Note</Label>
          <Select id="pick-note" value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Select…</option>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title || "Untitled note"}
              </option>
            ))}
          </Select>
        </div>
      )}
    </Modal>
  );
}
