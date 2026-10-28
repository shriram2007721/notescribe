import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { addCards, draftsFromHighlights, reviewCard } from "@/lib/cards";
import { db, NoteScribeDB } from "@/lib/db";
import { createFolder, deleteFolder, renameFolder } from "@/lib/folders";
import { createNote, deleteNoteForever, emptyTrash, moveToFolder, restoreNote, setPinned, trashNote, updateNote } from "@/lib/notes";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("v2 -> v3 migration", () => {
  it("keeps existing notes and settings, and adds default organization fields", async () => {
    const name = `migrate-${Math.random()}`;
    const v2 = new Dexie(name);
    v2.version(1).stores({ notes: "id, updatedAt, createdAt, *tags, shareId, syncStatus", settings: "key" });
    v2.version(2).stores({ community: "id, publishedAt, *tags, noteId" });
    await v2.table("notes").add({
      id: "old",
      title: "Lecture 1",
      content: { type: "doc", content: [] },
      plainText: "hello",
      tags: ["exam"],
      createdAt: 1,
      updatedAt: 2,
      shareId: "s1",
      syncStatus: "synced",
    });
    await v2.table("settings").put({ key: "authorName", value: "Ana" });
    v2.close();

    const v3 = new NoteScribeDB(name);
    const note = await v3.notes.get("old");
    expect(note).toMatchObject({ title: "Lecture 1", plainText: "hello", tags: ["exam"], shareId: "s1", updatedAt: 2, pinned: 0, favorite: 0 });
    expect(note?.folderId).toBeUndefined();
    expect(note?.deletedAt).toBeUndefined();
    expect((await v3.settings.get("authorName"))?.value).toBe("Ana");
    expect(v3.verno).toBe(3);
    expect(await v3.notes.where("pinned").equals(0).count()).toBe(1);
    v3.close();
  });
});

describe("notes CRUD", () => {
  it("creates, updates, pins and moves notes", async () => {
    const n = await createNote({ title: "T" });
    await updateNote(n.id, { title: "T2", plainText: "body" });
    await setPinned(n.id, true);
    const f = await createFolder("  Physics  ");
    await moveToFolder(n.id, f.id);
    const saved = await db.notes.get(n.id);
    expect(saved).toMatchObject({ title: "T2", plainText: "body", pinned: 1, folderId: f.id });
    expect(saved!.updatedAt).toBeGreaterThanOrEqual(n.updatedAt);
    expect((await db.folders.get(f.id))?.name).toBe("Physics");
  });

  it("trash is recoverable; permanent delete keeps flashcards but unlinks them", async () => {
    const n = await createNote({ title: "Doomed" });
    const [card] = await addCards([{ front: "q", back: "a" }], { noteId: n.id });
    await trashNote(n.id);
    expect((await db.notes.get(n.id))?.deletedAt).toBeTypeOf("number");
    await restoreNote(n.id);
    expect((await db.notes.get(n.id))?.deletedAt).toBeUndefined();
    await deleteNoteForever(n.id);
    expect(await db.notes.get(n.id)).toBeUndefined();
    expect(await db.cards.get(card.id)).toBeDefined();
    expect((await db.cards.get(card.id))?.noteId).toBeUndefined();
  });

  it("emptyTrash removes only trashed notes", async () => {
    const keep = await createNote();
    const gone = await createNote();
    await trashNote(gone.id);
    expect(await emptyTrash()).toBe(1);
    expect(await db.notes.get(keep.id)).toBeDefined();
    expect(await db.notes.get(gone.id)).toBeUndefined();
  });

  it("deleting a folder moves its notes to Unfiled instead of deleting them", async () => {
    const f = await createFolder("Maths");
    await renameFolder(f.id, "Math");
    expect((await db.folders.get(f.id))?.name).toBe("Math");
    const n = await createNote({ folderId: f.id });
    await deleteFolder(f.id);
    expect(await db.folders.get(f.id)).toBeUndefined();
    expect(await db.notes.get(n.id)).toBeDefined();
    expect((await db.notes.get(n.id))?.folderId).toBeUndefined();
  });

  it("rejects empty folder names", async () => {
    await expect(createFolder("   ")).rejects.toThrow();
  });
});

describe("flashcards", () => {
  it("reviewing updates the schedule and logs a review", async () => {
    const [card] = await addCards([{ front: "Capital of France?", back: "Paris" }]);
    const now = Date.UTC(2026, 0, 1);
    await reviewCard(card, "good", now);
    expect(await db.cards.get(card.id)).toMatchObject({ reps: 1, interval: 1, lastReviewedAt: now });
    const reviews = await db.reviews.toArray();
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ cardId: card.id, rating: "good", intervalBefore: 0, intervalAfter: 1 });
  });

  it("validates card text", async () => {
    await expect(addCards([{ front: " ", back: "x" }])).rejects.toThrow();
  });

  it("drafts cloze cards from highlights", () => {
    const hl = (tag: string) => [{ type: "smartHighlight", attrs: { tag } }];
    const drafts = draftsFromHighlights({
      title: "OS",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "A deadlock needs " },
              { type: "text", text: "circular wait", marks: hl("exam") },
              { type: "text", text: ". Next sentence." },
            ],
          },
          { type: "paragraph", content: [{ type: "text", text: "Whole sentence", marks: hl("concept") }] },
        ],
      },
    });
    expect(drafts).toEqual([
      { front: "OS: fill in the blank\nA deadlock needs _____.", back: "circular wait" },
      { front: "OS: recall this key concept", back: "Whole sentence" },
    ]);
  });
});
