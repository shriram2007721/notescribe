"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TagChips } from "@/components/tag-chips";
import type { HighlightTag } from "@/lib/db";
import { HIGHLIGHTS, HIGHLIGHT_ORDER, HIGHLIGHT_STYLES } from "@/lib/highlights";
import { community, ensureCommunitySeeded } from "@/lib/share";
import { cn } from "@/lib/utils";

export default function CommunityPage() {
  const [tag, setTag] = useState<HighlightTag | null>(null);
  const posts = useLiveQuery(() => community.list(), []);
  useEffect(() => {
    ensureCommunitySeeded();
  }, []);
  const visible = posts?.filter((p) => !tag || p.tags.includes(tag));

  return (
    <main className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Community feed</h1>
        <p className="text-sm text-muted-foreground">Notes other learners have shared, with their highlights.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTag(null)}
          className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", !tag ? "border-transparent bg-foreground text-background" : "hover:bg-accent")}
        >
          All
        </button>
        {HIGHLIGHT_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(tag === t ? null : t)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              tag === t ? cn(HIGHLIGHT_STYLES[t].chip, "border-transparent") : "hover:bg-accent",
            )}
          >
            {HIGHLIGHTS[t].icon} {HIGHLIGHTS[t].label}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible?.map((p) => (
          <li key={p.id} className="relative flex flex-col rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
            <Link href={`/shared?post=${p.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${p.title}`} />
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {p.author.slice(0, 1).toUpperCase()}
              </span>
              <div className="text-xs leading-tight">
                <p className="font-medium">{p.author}</p>
                <p className="text-muted-foreground">{new Date(p.publishedAt).toLocaleDateString()}</p>
              </div>
            </div>
            <h2 className="mb-1 font-medium">{p.title}</h2>
            <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.plainText}</p>
            <div className="flex items-end justify-between gap-2">
              <TagChips tags={p.tags} />
              <button
                type="button"
                onClick={() => community.toggleLike(p.id)}
                aria-pressed={!!p.likedByMe}
                aria-label="Like"
                className="relative z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                <Heart className={cn("h-4 w-4", p.likedByMe && "fill-red-500 text-red-500")} />
                {p.likes}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {visible?.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No posts with that highlight yet.</p>}
    </main>
  );
}
