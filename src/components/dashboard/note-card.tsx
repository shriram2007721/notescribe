"use client";

import { FolderInput, Globe, Pin, RotateCcw, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TagChips } from "@/components/tag-chips";
import { useFeedback } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Folder, Note } from "@/lib/db";
import { deleteNoteForever, moveToFolder, restoreNote, setFavorite, setPinned, trashNote } from "@/lib/notes";
import { cn } from "@/lib/utils";

const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function NoteCard({ note, folders }: { note: Note; folders: Folder[] }) {
  const { toast, confirm } = useFeedback();
  const [moving, setMoving] = useState(false);
  const trashed = note.deletedAt !== undefined;
  const folder = folders.find((f) => f.id === note.folderId);
  const title = note.title || "Untitled note";

  const toTrash = async () => {
    await trashNote(note.id);
    toast({ title: `Moved "${title}" to Trash`, action: { label: "Undo", onClick: () => restoreNote(note.id) } });
  };

  const forever = async () => {
    const ok = await confirm({
      title: `Delete "${title}" permanently?`,
      description: "This can't be undone. Flashcards made from this note are kept.",
      confirmLabel: "Delete forever",
      destructive: true,
    });
    if (ok) {
      await deleteNoteForever(note.id);
      toast({ title: "Note deleted permanently" });
    }
  };

  return (
    <li className="group relative flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm focus-within:ring-2 focus-within:ring-ring">
      {!trashed && <Link href={`/note?id=${note.id}`} className="absolute inset-0 rounded-lg outline-none" aria-label={`Open ${title}`} />}

      <div className="mb-1.5 flex items-start gap-2">
        <h3 className="line-clamp-2 flex-1 font-medium leading-snug">{title}</h3>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          {note.pinned === 1 && <Pin className="h-3.5 w-3.5 fill-current" aria-label="Pinned" />}
          {note.favorite === 1 && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label="Favorite" />}
          {note.shareId && <Globe className="h-3.5 w-3.5 text-primary" aria-label="Shared to community" />}
        </span>
      </div>

      <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{note.plainText || <span className="italic">Empty note</span>}</p>

      <TagChips tags={note.tags} />

      <div className="mt-3 flex flex-col gap-1.5 sm:block">
        <p className="min-w-0 truncate text-xs leading-7 text-muted-foreground">
          {folder && <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5">{folder.name}</span>}
          {trashed ? `Trashed ${fmt(note.deletedAt!)}` : <span title={`Created ${fmt(note.createdAt)}`}>Edited {fmt(note.updatedAt)}</span>}
        </p>

        {/* Above the full-card link (z-10). Own row on phones; on larger screens an overlay revealed on hover/focus, so it never truncates the date. */}
        <div className="relative z-10 -ml-1.5 flex items-center transition-opacity sm:absolute sm:bottom-3 sm:right-3 sm:ml-0 sm:rounded-md sm:bg-card sm:opacity-0 sm:shadow-[0_0_0_4px_hsl(var(--card))] sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {trashed ? (
            <>
              <IconButton label="Restore" onClick={() => restoreNote(note.id)} icon={RotateCcw} />
              <IconButton label="Delete forever" onClick={forever} icon={X} />
            </>
          ) : (
            <>
              <IconButton label={note.pinned ? "Unpin" : "Pin"} onClick={() => setPinned(note.id, !note.pinned)} icon={Pin} active={note.pinned === 1} />
              <IconButton
                label={note.favorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => setFavorite(note.id, !note.favorite)}
                icon={Star}
                active={note.favorite === 1}
              />
              <IconButton label="Move to subject" onClick={() => setMoving(true)} icon={FolderInput} />
              <IconButton label="Move to Trash" onClick={toTrash} icon={Trash2} />
            </>
          )}
        </div>
      </div>

      <MoveDialog open={moving} onClose={() => setMoving(false)} note={note} folders={folders} />
    </li>
  );
}

function IconButton({ label, onClick, icon: Icon, active }: { label: string; onClick: () => void; icon: typeof Pin; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground", active && "text-foreground")}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
    </button>
  );
}

export function MoveDialog({ open, onClose, note, folders }: { open: boolean; onClose: () => void; note: Note; folders: Folder[] }) {
  const [target, setTarget] = useState(note.folderId ?? "");
  const { toast } = useFeedback();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to subject"
      description={note.title || "Untitled note"}
      className="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await moveToFolder(note.id, target || undefined);
              toast({ title: target ? `Moved to ${folders.find((f) => f.id === target)?.name}` : "Moved to Unfiled", tone: "success" });
              onClose();
            }}
          >
            Move
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor={`move-${note.id}`}>Subject</Label>
        <Select id={`move-${note.id}`} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Unfiled</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        {folders.length === 0 && <p className="text-xs text-muted-foreground">Create subjects with the + next to “Subjects” in the sidebar.</p>}
      </div>
    </Modal>
  );
}
