import Dexie, { type EntityTable } from "dexie";
import { nanoid } from "nanoid";

export type HighlightTag = "exam" | "interview" | "concept";

export interface Note {
  id: string;
  title: string;
  /** TipTap JSON document (source of truth for rendering). */
  content: unknown;
  /** Plain-text projection used for search and card previews. */
  plainText: string;
  /** Distinct highlight tags present in the note, kept in sync by the editor. */
  tags: HighlightTag[];
  createdAt: number;
  updatedAt: number;
  /** Set when the note is shared to the community hub. */
  shareId?: string;
  sharedAt?: number;
  /** "pending" means a local change hasn't been pushed to the sharing backend. */
  syncStatus: "local" | "pending" | "synced";
}

export interface Setting {
  key: string;
  value: unknown;
}

/** A note published to the community feed. Stored locally by the mock backend. */
export interface CommunityPost {
  id: string;
  noteId?: string;
  title: string;
  author: string;
  content: unknown;
  plainText: string;
  tags: HighlightTag[];
  publishedAt: number;
  likes: number;
  likedByMe?: boolean;
}

class NoteScribeDB extends Dexie {
  notes!: EntityTable<Note, "id">;
  settings!: EntityTable<Setting, "key">;
  community!: EntityTable<CommunityPost, "id">;

  constructor() {
    super("notescribe");
    this.version(1).stores({
      // *tags is a multi-entry index so we can query "all notes with exam highlights".
      notes: "id, updatedAt, createdAt, *tags, shareId, syncStatus",
      settings: "key",
    });
    this.version(2).stores({
      community: "id, publishedAt, *tags, noteId",
    });
  }
}

export const db = new NoteScribeDB();

export async function createNote(partial: Partial<Note> = {}): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: nanoid(),
    title: "Untitled note",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    plainText: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    ...partial,
  };
  await db.notes.add(note);
  return note;
}

export function updateNote(id: string, changes: Partial<Omit<Note, "id" | "createdAt">>) {
  return db.notes.update(id, {
    ...changes,
    updatedAt: Date.now(),
  });
}

export function deleteNote(id: string) {
  return db.notes.delete(id);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}
