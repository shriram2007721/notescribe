import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createNote } from "@/lib/notes";
import { journalClear, journalWrite, recoverJournal } from "@/lib/save-journal";

/** Minimal in-memory Storage for Node. */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("save journal", () => {
  it("recovers an edit whose IndexedDB write never committed", async () => {
    const kv = memoryStorage();
    const note = await createNote({ title: "Lecture", plainText: "old" });
    journalWrite(note.id, { plainText: "old + last words", title: "Lecture 2" }, note.updatedAt + 1000, kv);
    // ...page unloads before the async write; on next load:
    expect(await recoverJournal(kv)).toBe(1);
    expect(await db.notes.get(note.id)).toMatchObject({ plainText: "old + last words", title: "Lecture 2", updatedAt: note.updatedAt + 1000 });
    expect(kv.length).toBe(0);
  });

  it("ignores a stale entry older than what is stored", async () => {
    const kv = memoryStorage();
    const note = await createNote({ plainText: "newer" });
    journalWrite(note.id, { plainText: "stale" }, note.updatedAt - 1, kv);
    expect(await recoverJournal(kv)).toBe(0);
    expect((await db.notes.get(note.id))?.plainText).toBe("newer");
    expect(kv.length).toBe(0);
  });

  it("only clears the entry it wrote, so a newer pending write survives", () => {
    const kv = memoryStorage();
    journalWrite("n1", { title: "a" }, 1, kv);
    journalWrite("n1", { title: "b" }, 2, kv);
    journalClear("n1", 1, kv);
    expect(kv.length).toBe(1);
    journalClear("n1", 2, kv);
    expect(kv.length).toBe(0);
  });

  it("reports failure when storage is full instead of throwing", () => {
    const full = { ...memoryStorage(), setItem: () => { throw new DOMException("full", "QuotaExceededError"); } };
    expect(journalWrite("n1", { title: "x" }, 1, full)).toBe(false);
  });
});
