import { nanoid } from "nanoid";
import { z } from "zod";
import { db, type Flashcard, type Folder, type Note, type QuizAttempt, type Review } from "./db";

/*
 * JSON backup format (version 1):
 * { format: "notescribe-backup", version: 1, exportedAt, notes, folders, cards, reviews, quizAttempts }
 * Imports never overwrite: every record gets a fresh ID and references are remapped.
 */

export const BACKUP_FORMAT = "notescribe-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

const tag = z.enum(["exam", "interview", "concept"]);
const flag = z.union([z.literal(0), z.literal(1)]).default(0);
const time = z.number().finite().nonnegative();
const doc = z
  .object({ type: z.literal("doc") })
  .passthrough()
  .refine((d) => JSON.stringify(d).length < 5_000_000, "note content too large");

const noteSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(500),
  content: doc,
  plainText: z.string().default(""),
  tags: z.array(tag).default([]),
  createdAt: time,
  updatedAt: time,
  folderId: z.string().optional(),
  pinned: flag,
  favorite: flag,
  deletedAt: time.optional(),
});

const folderSchema = z.object({ id: z.string().min(1), name: z.string().min(1).max(200), createdAt: time, order: z.number() });

const cardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1).max(5000),
  back: z.string().min(1).max(5000),
  noteId: z.string().optional(),
  folderId: z.string().optional(),
  source: z.enum(["manual", "highlight", "ai"]).default("manual"),
  createdAt: time,
  updatedAt: time,
  due: time,
  interval: z.number().nonnegative(),
  ease: z.number().min(1),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  lastReviewedAt: time.optional(),
});

const rating = z.enum(["again", "hard", "good", "easy"]);
const reviewSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating,
  reviewedAt: time,
  intervalBefore: z.number(),
  intervalAfter: z.number(),
});

const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(500),
  source: z.enum(["flashcards", "ai"]),
  noteIds: z.array(z.string()).default([]),
  total: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  answers: z
    .array(z.object({ questionId: z.string(), prompt: z.string(), correct: z.boolean(), given: z.string(), expected: z.string() }))
    .default([]),
  startedAt: time,
  finishedAt: time,
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: time,
  notes: z.array(noteSchema),
  folders: z.array(folderSchema).default([]),
  cards: z.array(cardSchema).default([]),
  reviews: z.array(reviewSchema).default([]),
  quizAttempts: z.array(quizSchema).default([]),
});

export type Backup = z.infer<typeof backupSchema>;

export async function createBackup(now = Date.now()): Promise<Backup> {
  const [notes, folders, cards, reviews, quizAttempts] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.quizAttempts.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    // Sharing state is device-specific, so it isn't carried over.
    notes: notes.map((n) => {
      const copy: Partial<Note> = { ...n, plainText: n.plainText ?? "" };
      delete copy.shareId;
      delete copy.sharedAt;
      delete copy.syncStatus;
      return copy as Backup["notes"][number];
    }),
    folders,
    cards,
    reviews,
    quizAttempts,
  };
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  if (!raw || typeof raw !== "object" || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, error: "This isn't a NoteScribe backup file." };
  }
  if ((raw as { version?: unknown }).version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version. This app reads version ${BACKUP_VERSION}.` };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `The backup is damaged (${issue.path.join(".") || "root"}: ${issue.message}).` };
  }
  return { ok: true, backup: parsed.data };
}

export interface ImportSummary {
  notes: number;
  folders: number;
  cards: number;
  reviews: number;
  quizAttempts: number;
}

/** Adds everything from the backup as new records (fresh IDs), so nothing existing is overwritten. */
export async function importBackup(backup: Backup): Promise<ImportSummary> {
  const folderIds = new Map(backup.folders.map((f) => [f.id, nanoid()]));
  const noteIds = new Map(backup.notes.map((n) => [n.id, nanoid()]));
  const cardIds = new Map(backup.cards.map((c) => [c.id, nanoid()]));
  const remapFolder = (id?: string) => (id ? folderIds.get(id) : undefined);

  const lastOrder = (await db.folders.orderBy("order").last())?.order ?? 0;
  const folders: Folder[] = backup.folders.map((f, i) => ({ ...f, id: folderIds.get(f.id)!, order: lastOrder + i + 1 }));
  const notes: Note[] = backup.notes.map((n) => ({
    ...n,
    id: noteIds.get(n.id)!,
    folderId: remapFolder(n.folderId),
    syncStatus: "local",
  }));
  const cards: Flashcard[] = backup.cards.map((c) => ({
    ...c,
    id: cardIds.get(c.id)!,
    noteId: c.noteId ? noteIds.get(c.noteId) : undefined,
    folderId: remapFolder(c.folderId),
  }));
  const reviews: Review[] = backup.reviews
    .filter((r) => cardIds.has(r.cardId))
    .map((r) => ({ ...r, id: nanoid(), cardId: cardIds.get(r.cardId)! }));
  const quizAttempts: QuizAttempt[] = backup.quizAttempts.map((q) => ({
    ...q,
    id: nanoid(),
    noteIds: q.noteIds.map((id) => noteIds.get(id)).filter((id): id is string => Boolean(id)),
  }));

  await db.transaction("rw", [db.folders, db.notes, db.cards, db.reviews, db.quizAttempts], async () => {
    await db.folders.bulkAdd(folders);
    await db.notes.bulkAdd(notes);
    await db.cards.bulkAdd(cards);
    await db.reviews.bulkAdd(reviews);
    await db.quizAttempts.bulkAdd(quizAttempts);
  });

  return { notes: notes.length, folders: folders.length, cards: cards.length, reviews: reviews.length, quizAttempts: quizAttempts.length };
}
