import { beforeEach, describe, expect, it } from "vitest";
import { createBackup, importBackup, parseBackup } from "@/lib/backup";
import { addCards, reviewCard } from "@/lib/cards";
import { db } from "@/lib/db";
import { createFolder } from "@/lib/folders";
import { createNote } from "@/lib/notes";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("JSON backup", () => {
  it("round-trips: export -> parse -> import adds copies with remapped references", async () => {
    const folder = await createFolder("Chemistry");
    const note = await createNote({ title: "Acids", folderId: folder.id, plainText: "pH", tags: ["exam"], pinned: 1 });
    const [card] = await addCards([{ front: "pH of water?", back: "7" }], { noteId: note.id, folderId: folder.id });
    await reviewCard(card, "good");

    const parsed = parseBackup(JSON.stringify(await createBackup()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(await importBackup(parsed.backup)).toEqual({ notes: 1, folders: 1, cards: 1, reviews: 1, quizAttempts: 0 });

    // Originals untouched, copies added with new IDs.
    expect(await db.notes.get(note.id)).toMatchObject({ title: "Acids" });
    expect(await db.notes.count()).toBe(2);
    const copy = (await db.notes.toArray()).find((n) => n.id !== note.id)!;
    expect(copy).toMatchObject({ title: "Acids", plainText: "pH", tags: ["exam"], pinned: 1, syncStatus: "local" });
    const copyFolder = (await db.folders.toArray()).find((f) => f.id !== folder.id)!;
    expect(copy.folderId).toBe(copyFolder.id);
    const copyCard = (await db.cards.toArray()).find((c) => c.id !== card.id)!;
    expect(copyCard.noteId).toBe(copy.id);
    expect((await db.reviews.toArray()).some((r) => r.cardId === copyCard.id)).toBe(true);
  });

  it("rejects malformed input with a readable message", () => {
    expect(parseBackup("{not json")).toEqual({ ok: false, error: "This file isn't valid JSON." });
    expect(parseBackup('{"format":"other"}')).toEqual({ ok: false, error: "This isn't a NoteScribe backup file." });
    expect(parseBackup('{"format":"notescribe-backup","version":9}').ok).toBe(false);
    const bad = parseBackup(JSON.stringify({ format: "notescribe-backup", version: 1, exportedAt: 1, notes: [{ id: "x" }] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/notes\.0/);
  });
});
