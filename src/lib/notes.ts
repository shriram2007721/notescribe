import { nanoid } from "nanoid";
import { db, type Note } from "./db";

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export async function createNote(partial: Partial<Note> = {}): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: nanoid(),
    title: "Untitled note",
    content: EMPTY_DOC,
    plainText: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    pinned: 0,
    favorite: 0,
    ...partial,
  };
  await db.notes.add(note);
  return note;
}

export function updateNote(id: string, changes: Partial<Omit<Note, "id" | "createdAt">>) {
  return db.notes.update(id, { ...changes, updatedAt: Date.now() });
}

/** Changes that shouldn't count as "editing" the note (organization only). */
function updateMeta(id: string, changes: Partial<Pick<Note, "pinned" | "favorite" | "folderId" | "deletedAt">>) {
  return db.notes.update(id, changes);
}

export const setPinned = (id: string, pinned: boolean) => updateMeta(id, { pinned: pinned ? 1 : 0 });
export const setFavorite = (id: string, favorite: boolean) => updateMeta(id, { favorite: favorite ? 1 : 0 });
export const moveToFolder = (id: string, folderId: string | undefined) => updateMeta(id, { folderId });

/** Soft delete: the note goes to Trash and can be restored. */
export const trashNote = (id: string) => updateMeta(id, { deletedAt: Date.now() });
export const restoreNote = (id: string) => updateMeta(id, { deletedAt: undefined });

/** Permanent delete. Flashcards made from the note are kept but lose the link. */
export async function deleteNoteForever(id: string) {
  await db.transaction("rw", db.notes, db.cards, async () => {
    await db.cards.where("noteId").equals(id).modify({ noteId: undefined });
    await db.notes.delete(id);
  });
}

export async function emptyTrash() {
  const trashed = await db.notes.filter((n) => n.deletedAt !== undefined).primaryKeys();
  for (const id of trashed) await deleteNoteForever(id);
  return trashed.length;
}

export const isActive = (n: Note) => n.deletedAt === undefined;

/* ---------------- Querying (pure, so it is unit-testable) ---------------- */

export type NoteSort = "updated" | "created" | "title";

export interface NoteQuery {
  text?: string;
  tag?: Note["tags"][number] | null;
  /** undefined = all folders, "unfiled" = no folder, otherwise a folder id. */
  folder?: string;
  pinnedOnly?: boolean;
  favoritesOnly?: boolean;
  trash?: boolean;
  sort?: NoteSort;
}

export function filterNotes(notes: Note[], q: NoteQuery): Note[] {
  const text = q.text?.trim().toLowerCase() ?? "";
  const terms = text ? text.split(/\s+/) : [];
  const out = notes.filter((n) => {
    if (Boolean(q.trash) !== (n.deletedAt !== undefined)) return false;
    if (q.tag && !n.tags.includes(q.tag)) return false;
    if (q.folder === "unfiled" ? n.folderId : q.folder && n.folderId !== q.folder) return false;
    if (q.pinnedOnly && !n.pinned) return false;
    if (q.favoritesOnly && !n.favorite) return false;
    if (terms.length) {
      const hay = `${n.title}\n${n.plainText}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  return sortNotes(out, q.sort ?? "updated");
}

export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const copy = [...notes];
  if (sort === "title") copy.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
  else if (sort === "created") copy.sort((a, b) => b.createdAt - a.createdAt);
  else copy.sort((a, b) => b.updatedAt - a.updatedAt);
  return copy;
}
