"use client";

import { Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { addCards, draftsFromHighlights } from "@/lib/cards";
import type { Note } from "@/lib/db";

/** Turns a note's smart highlights into editable flashcard drafts; nothing is saved until confirmed. */
export function HighlightCardsDialog({ note, open, onClose }: { note: Note | null; open: boolean; onClose: () => void }) {
  const { toast } = useFeedback();
  const [drafts, setDrafts] = useState<{ front: string; back: string; keep: boolean }[]>([]);

  // Build drafts once when the dialog opens; later re-renders must not wipe the user's edits.
  useEffect(() => {
    if (open && note) setDrafts(draftsFromHighlights(note).map((d) => ({ ...d, keep: true })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const keep = drafts.filter((d) => d.keep && d.front.trim() && d.back.trim());

  const save = async () => {
    if (!note || !keep.length) return;
    await addCards(
      keep.map(({ front, back }) => ({ front, back })),
      { source: "highlight", noteId: note.id, folderId: note.folderId },
    );
    toast({ title: `Created ${keep.length} flashcards`, tone: "success" });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Flashcards from highlights"
      description={note ? `From “${note.title || "Untitled note"}”. Edit the cards, then save.` : undefined}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!keep.length}>
            <Layers className="h-4 w-4" /> Save {keep.length} cards
          </Button>
        </>
      }
    >
      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This note has no highlights yet. Select text in the editor and mark it 📚 Exam, 💼 Interview or 💡 Concept, then try again.
        </p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((d, i) => (
            <li key={i} className="flex gap-2 rounded-lg border p-2">
              <input
                type="checkbox"
                checked={d.keep}
                onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                className="mt-2.5 h-4 w-4 accent-[hsl(var(--primary))]"
                aria-label={`Include card ${i + 1}`}
              />
              <div className="grid flex-1 gap-1.5">
                <Textarea
                  value={d.front}
                  onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))}
                  className="min-h-14"
                  aria-label={`Card ${i + 1} question`}
                />
                <Input value={d.back} onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))} aria-label={`Card ${i + 1} answer`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
