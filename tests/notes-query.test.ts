import { describe, expect, it } from "vitest";
import type { Note } from "@/lib/db";
import { filterNotes } from "@/lib/notes";

const base = (over: Partial<Note>): Note => ({
  id: "x",
  title: "",
  content: { type: "doc" },
  plainText: "",
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  syncStatus: "local",
  pinned: 0,
  favorite: 0,
  ...over,
});

const notes = [
  base({ id: "a", title: "Operating Systems", plainText: "deadlock and semaphores", tags: ["exam"], createdAt: 1, updatedAt: 30, folderId: "f1", pinned: 1 }),
  base({ id: "b", title: "behavioural interview", plainText: "STAR method", tags: ["interview"], createdAt: 3, updatedAt: 10, favorite: 1 }),
  base({ id: "c", title: "Biology", plainText: "photosynthesis deadlock?", createdAt: 2, updatedAt: 20, folderId: "f2" }),
  base({ id: "d", title: "Old", plainText: "deadlock", createdAt: 4, updatedAt: 40, deletedAt: 50 }),
];

const ids = (n: Note[]) => n.map((x) => x.id);

describe("filterNotes", () => {
  it("hides trashed notes by default and shows only them in trash view", () => {
    expect(ids(filterNotes(notes, {}))).toEqual(["a", "c", "b"]);
    expect(ids(filterNotes(notes, { trash: true }))).toEqual(["d"]);
  });

  it("searches title and content; all terms must match; case-insensitive", () => {
    expect(ids(filterNotes(notes, { text: "DEADLOCK" }))).toEqual(["a", "c"]);
    expect(ids(filterNotes(notes, { text: "deadlock semaphores" }))).toEqual(["a"]);
    expect(ids(filterNotes(notes, { text: "  " }))).toHaveLength(3);
  });

  it("filters by tag, folder, unfiled, pinned and favorites", () => {
    expect(ids(filterNotes(notes, { tag: "interview" }))).toEqual(["b"]);
    expect(ids(filterNotes(notes, { folder: "f1" }))).toEqual(["a"]);
    expect(ids(filterNotes(notes, { folder: "unfiled" }))).toEqual(["b"]);
    expect(ids(filterNotes(notes, { pinnedOnly: true }))).toEqual(["a"]);
    expect(ids(filterNotes(notes, { favoritesOnly: true }))).toEqual(["b"]);
  });

  it("sorts by updated, created and title", () => {
    expect(ids(filterNotes(notes, { sort: "updated" }))).toEqual(["a", "c", "b"]);
    expect(ids(filterNotes(notes, { sort: "created" }))).toEqual(["b", "c", "a"]);
    expect(ids(filterNotes(notes, { sort: "title" }))).toEqual(["b", "c", "a"]);
  });
});
