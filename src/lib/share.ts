import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { nanoid } from "nanoid";
import { db, getSetting, setSetting, updateNote, type CommunityPost, type HighlightTag, type Note } from "@/lib/db";
import { SEED_POSTS } from "@/lib/seed";

/* ------------------------------------------------------------------ */
/* Public links: the whole note is compressed into the URL fragment.  */
/* No server needed, and the fragment never leaves the browser.       */
/* ------------------------------------------------------------------ */

export interface SharePayload {
  v: 1;
  title: string;
  author?: string;
  content: unknown;
  tags: HighlightTag[];
}

export function buildShareUrl(note: Pick<Note, "title" | "content" | "tags">, author?: string) {
  const payload: SharePayload = { v: 1, title: note.title, author, content: note.content, tags: note.tags };
  return `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/shared#${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function decodeSharePayload(fragment: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(fragment.replace(/^#/, ""));
    const data = json ? (JSON.parse(json) as SharePayload) : null;
    return data?.v === 1 && data.content ? data : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Community feed: the backend sits behind an interface. The mock     */
/* stores posts in IndexedDB; swap in Supabase etc. later.            */
/* ------------------------------------------------------------------ */

export interface CommunityBackend {
  list(): Promise<CommunityPost[]>;
  get(id: string): Promise<CommunityPost | undefined>;
  publish(post: CommunityPost): Promise<void>;
  remove(id: string): Promise<void>;
  toggleLike(id: string): Promise<void>;
}

export const mockCommunityBackend: CommunityBackend = {
  // Read-only so it can run inside Dexie liveQuery; seeding happens via ensureCommunitySeeded().
  list: () => db.community.orderBy("publishedAt").reverse().toArray(),
  async get(id) {
    await ensureCommunitySeeded();
    return db.community.get(id);
  },
  publish: async (post) => {
    await db.community.put(post);
  },
  remove: (id) => db.community.delete(id),
  async toggleLike(id) {
    const post = await db.community.get(id);
    if (!post) return;
    await db.community.update(id, {
      likedByMe: !post.likedByMe,
      likes: post.likes + (post.likedByMe ? -1 : 1),
    });
  },
};

export const community: CommunityBackend = mockCommunityBackend;

export async function ensureCommunitySeeded() {
  if (await getSetting("communitySeeded", false)) return;
  await db.community.bulkPut(SEED_POSTS);
  await setSetting("communitySeeded", true);
}

export async function publishNote(note: Note, author: string) {
  const existing = note.shareId ? await community.get(note.shareId) : undefined;
  const id = note.shareId ?? nanoid(10);
  await community.publish({
    id,
    noteId: note.id,
    title: note.title,
    author: author.trim() || "Anonymous",
    content: note.content,
    plainText: note.plainText,
    tags: note.tags,
    publishedAt: Date.now(),
    likes: existing?.likes ?? 0,
    likedByMe: existing?.likedByMe,
  });
  await updateNote(note.id, { shareId: id, sharedAt: Date.now(), syncStatus: "synced" });
  return id;
}

export async function unpublishNote(note: Note) {
  if (note.shareId) await community.remove(note.shareId);
  await updateNote(note.id, { shareId: undefined, sharedAt: undefined, syncStatus: "local" });
}
