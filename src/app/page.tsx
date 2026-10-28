"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Globe, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagChips } from "@/components/tag-chips";
import { Button } from "@/components/ui/button";
import { createNote, db, deleteNote, type HighlightTag } from "@/lib/db";
import { HIGHLIGHTS, HIGHLIGHT_ORDER, HIGHLIGHT_STYLES } from "@/lib/highlights";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<HighlightTag | null>(null);

  const notes = useLiveQuery(async () => {
    const all = tag
      ? await db.notes.where("tags").equals(tag).toArray()
      : await db.notes.toArray();
    const q = query.trim().toLowerCase();
    return all
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.plainText.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [query, tag]);

  const newNote = async () => {
    const note = await createNote();
    router.push(`/note?id=${note.id}`);
  };

  return (
    <main className="container py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My notes</h1>
          <p className="text-sm text-muted-foreground">Stored on this device and available offline.</p>
        </div>
        <Button onClick={newNote}>
          <Plus className="h-4 w-4" /> New note
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HIGHLIGHT_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                tag === t ? cn(HIGHLIGHT_STYLES[t].chip, "border-transparent") : "hover:bg-accent",
              )}
            >
              {HIGHLIGHTS[t].icon} Has {HIGHLIGHTS[t].short}
            </button>
          ))}
        </div>
      </div>

      {notes && notes.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">{query || tag ? "No notes match." : "No notes yet"}</p>
          {!query && !tag && (
            <p className="mt-1 text-sm text-muted-foreground">
              Create a note, dictate a lecture, and tag what matters for exams and interviews.
            </p>
          )}
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes?.map((n) => (
          <li key={n.id} className="group relative flex flex-col rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
            <Link href={`/note?id=${n.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${n.title}`} />
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="line-clamp-1 font-medium">{n.title || "Untitled note"}</h2>
              {n.shareId && (
                <span title="Shared to community" className="shrink-0 text-primary">
                  <Globe className="h-4 w-4" />
                </span>
              )}
            </div>
            <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted-foreground">
              {n.plainText || <span className="italic">Empty note</span>}
            </p>
            <div className="flex items-end justify-between gap-2">
              <div className="space-y-2">
                <TagChips tags={n.tags} />
                <p className="text-xs text-muted-foreground">{new Date(n.updatedAt).toLocaleDateString()}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete note"
                className="relative z-10 h-8 w-8 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => {
                  if (confirm(`Delete "${n.title}"?`)) deleteNote(n.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
