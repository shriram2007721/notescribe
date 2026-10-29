import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createNote } from "@/lib/notes";
import { buildSampleBackup, loadSampleData } from "@/lib/sample-data";
import { endOfDay } from "@/lib/srs";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("sample data", () => {
  it("builds a valid backup with some cards due today", () => {
    const now = Date.now();
    const b = buildSampleBackup(now);
    expect(b.notes.length).toBeGreaterThanOrEqual(6);
    expect(b.cards.some((c) => c.due <= endOfDay(now))).toBe(true);
    expect(b.cards.some((c) => c.due > endOfDay(now))).toBe(true);
    expect(b.quizAttempts).toHaveLength(3);
  });

  it("seeds an empty notebook once and publishes notes to the community", async () => {
    expect(await loadSampleData()).toBe(true);
    const notes = await db.notes.count();
    expect(await db.community.filter((p) => Boolean(p.noteId)).count()).toBe(3);
    expect(await loadSampleData()).toBe(false);
    expect(await db.notes.count()).toBe(notes);
  });

  it("adds samples next to existing notes without touching them", async () => {
    const mine = await createNote({ title: "Mine" });
    expect(await loadSampleData()).toBe(true);
    expect(await db.notes.get(mine.id)).toMatchObject({ title: "Mine" });
    expect(await db.cards.count()).toBeGreaterThan(0);
  });
});
