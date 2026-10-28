"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { addCards, MAX_CARD_TEXT, updateCard } from "@/lib/cards";
import { db, type Flashcard, type Folder } from "@/lib/db";

/** Create a card manually, or edit an existing one. */
export function CardEditor({ open, onClose, card, folders }: { open: boolean; onClose: () => void; card?: Flashcard; folders: Folder[] }) {
  const { toast } = useFeedback();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [folderId, setFolderId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFront(card?.front ?? "");
    setBack(card?.back ?? "");
    setFolderId(card?.folderId ?? "");
    setError(null);
  }, [open, card]);

  const save = async (addAnother: boolean) => {
    try {
      if (card) {
        await updateCard(card.id, { front, back });
        await db.cards.update(card.id, { folderId: folderId || undefined });
        toast({ title: "Card updated", tone: "success" });
        onClose();
      } else {
        await addCards([{ front, back }], { folderId: folderId || undefined });
        toast({ title: "Card added", tone: "success" });
        if (addAnother) {
          setFront("");
          setBack("");
        } else onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the card.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? "Edit flashcard" : "New flashcard"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!card && (
            <Button variant="outline" onClick={() => save(true)} disabled={!front.trim() || !back.trim()}>
              Save & add another
            </Button>
          )}
          <Button onClick={() => save(false)} disabled={!front.trim() || !back.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="card-front">Question (front)</Label>
          <Textarea id="card-front" value={front} onChange={(e) => setFront(e.target.value)} maxLength={MAX_CARD_TEXT} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-back">Answer (back)</Label>
          <Textarea id="card-back" value={back} onChange={(e) => setBack(e.target.value)} maxLength={MAX_CARD_TEXT} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-folder">Subject</Label>
          <Select id="card-folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">None</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
