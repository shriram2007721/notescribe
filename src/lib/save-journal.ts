import type { Note } from "./db";
import { db } from "./db";

/*
 * Write-ahead journal for note saves.
 *
 * IndexedDB writes are asynchronous; if the page unloads a few milliseconds after a save starts
 * (closing the tab, reloading), the browser may abort the transaction and the last edit is lost.
 * localStorage writes are synchronous, so we copy pending changes there first and clear them once the
 * IndexedDB write commits. On the next load, any leftover entry that is newer than the stored note is applied.
 */

const PREFIX = "notescribe-pending:";

type Changes = Partial<Omit<Note, "id" | "createdAt">>;
interface Entry {
  changes: Changes;
  at: number;
}

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function storage(): KV | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Synchronously records pending changes. Returns false if they couldn't be journaled (quota, blocked storage). */
export function journalWrite(noteId: string, changes: Changes, at = Date.now(), kv: KV | null = storage()): boolean {
  if (!kv) return false;
  try {
    kv.setItem(PREFIX + noteId, JSON.stringify({ changes, at } satisfies Entry));
    return true;
  } catch {
    return false;
  }
}

/** Clears the entry, but only if it is the one we wrote (a newer write must survive). */
export function journalClear(noteId: string, at: number, kv: KV | null = storage()) {
  if (!kv) return;
  try {
    const raw = kv.getItem(PREFIX + noteId);
    if (raw && (JSON.parse(raw) as Entry).at === at) kv.removeItem(PREFIX + noteId);
  } catch {
    /* ignore */
  }
}

/** Applies leftover journal entries that are newer than what's stored. Returns how many notes were recovered. */
export async function recoverJournal(kv: KV | null = storage()): Promise<number> {
  if (!kv) return 0;
  const keys: string[] = [];
  for (let i = 0; i < kv.length; i++) {
    const k = kv.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  let recovered = 0;
  for (const key of keys) {
    const id = key.slice(PREFIX.length);
    try {
      const entry = JSON.parse(kv.getItem(key) ?? "null") as Entry | null;
      const note = await db.notes.get(id);
      if (entry && note && entry.at > note.updatedAt) {
        await db.notes.update(id, { ...entry.changes, updatedAt: entry.at });
        recovered++;
      }
      kv.removeItem(key);
    } catch {
      /* leave malformed entries alone rather than risk losing data */
    }
  }
  return recovered;
}

let recovery: Promise<number> | null = null;
/** Runs recovery once per page load; callers await it before opening a note in the editor. */
export const recoverOnce = () => (recovery ??= recoverJournal().catch(() => 0));
