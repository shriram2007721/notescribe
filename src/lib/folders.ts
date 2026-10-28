import { nanoid } from "nanoid";
import { db, type Folder } from "./db";

export const MAX_FOLDER_NAME = 60;

function cleanName(name: string) {
  const n = name.trim().replace(/\s+/g, " ").slice(0, MAX_FOLDER_NAME);
  if (!n) throw new Error("Folder name can't be empty.");
  return n;
}

export async function createFolder(name: string): Promise<Folder> {
  const last = await db.folders.orderBy("order").last();
  const folder: Folder = { id: nanoid(), name: cleanName(name), createdAt: Date.now(), order: (last?.order ?? 0) + 1 };
  await db.folders.add(folder);
  return folder;
}

export function renameFolder(id: string, name: string) {
  return db.folders.update(id, { name: cleanName(name) });
}

/** Deletes the folder only; its notes and cards move to "Unfiled" rather than being deleted. */
export async function deleteFolder(id: string) {
  await db.transaction("rw", db.folders, db.notes, db.cards, async () => {
    await db.notes.where("folderId").equals(id).modify({ folderId: undefined });
    await db.cards.where("folderId").equals(id).modify({ folderId: undefined });
    await db.folders.delete(id);
  });
}
