import Dexie, { type EntityTable } from "dexie";

/** A tag id: one of the defaults (exam, interview, concept) or a user-created id. See highlights.ts. */
export type HighlightTag = string;

/** 0/1 instead of boolean because IndexedDB cannot index booleans. */
export type Flag = 0 | 1;

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
  /** v3: undefined = not in any folder ("Unfiled"). */
  folderId?: string;
  pinned: Flag;
  favorite: Flag;
  /** v3: set when moved to Trash; the note is hidden but recoverable. */
  deletedAt?: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  order: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  noteId?: string;
  folderId?: string;
  source: "manual" | "highlight" | "ai";
  createdAt: number;
  updatedAt: number;
  /** Scheduling state (see src/lib/srs.ts). */
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReviewedAt?: number;
}

export type Rating = "again" | "hard" | "good" | "easy";

export interface Review {
  id: string;
  cardId: string;
  rating: Rating;
  reviewedAt: number;
  intervalBefore: number;
  intervalAfter: number;
}

export interface QuizAnswerRecord {
  questionId: string;
  prompt: string;
  correct: boolean;
  given: string;
  expected: string;
}

export interface QuizAttempt {
  id: string;
  title: string;
  source: "flashcards" | "ai";
  noteIds: string[];
  total: number;
  correct: number;
  answers: QuizAnswerRecord[];
  startedAt: number;
  finishedAt: number;
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

export class NoteScribeDB extends Dexie {
  notes!: EntityTable<Note, "id">;
  settings!: EntityTable<Setting, "key">;
  community!: EntityTable<CommunityPost, "id">;
  folders!: EntityTable<Folder, "id">;
  cards!: EntityTable<Flashcard, "id">;
  reviews!: EntityTable<Review, "id">;
  quizAttempts!: EntityTable<QuizAttempt, "id">;

  constructor(name = "notescribe") {
    super(name);
    this.version(1).stores({
      // *tags is a multi-entry index so we can query "all notes with exam highlights".
      notes: "id, updatedAt, createdAt, *tags, shareId, syncStatus",
      settings: "key",
    });
    this.version(2).stores({
      community: "id, publishedAt, *tags, noteId",
    });
    this.version(3)
      .stores({
        notes: "id, updatedAt, createdAt, *tags, shareId, syncStatus, folderId, pinned, favorite, deletedAt",
        folders: "id, order, name",
        cards: "id, due, noteId, folderId, createdAt",
        reviews: "id, cardId, reviewedAt",
        quizAttempts: "id, finishedAt",
      })
      .upgrade((tx) =>
        // Existing notes keep all their data; they just gain the new flags and stay unfiled.
        tx
          .table("notes")
          .toCollection()
          .modify((n: Partial<Note>) => {
            if (n.pinned === undefined) n.pinned = 0;
            if (n.favorite === undefined) n.favorite = 0;
          }),
      );
  }
}

export const db = new NoteScribeDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}
