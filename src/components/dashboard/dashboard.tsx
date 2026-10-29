"use client";

import { ArrowUpDown, GraduationCap, Layers, Mic, Pencil, Pin, Plus, Search, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FolderDialog } from "@/components/shell/folder-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { useAllNotes, useCards, useFolders, useQuizAttempts, useReviews } from "@/hooks/use-data";
import type { HighlightTag } from "@/lib/db";
import { deleteFolder } from "@/lib/folders";
import { HIGHLIGHTS, HIGHLIGHT_ORDER, HIGHLIGHT_STYLES } from "@/lib/highlights";
import { createNote, emptyTrash, filterNotes, type NoteSort } from "@/lib/notes";
import { loadSampleData } from "@/lib/sample-data";
import { computeStats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { NoteCard } from "./note-card";
import { StatTile } from "./stat-tile";

const SORT_KEY = "notescribe-sort";

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const folderParam = params.get("folder") ?? undefined;
  const trash = params.get("view") === "trash";
  const home = !folderParam && !trash;

  const notes = useAllNotes();
  const folders = useFolders();
  const cards = useCards();
  const reviews = useReviews();
  const quizzes = useQuizAttempts();
  const { toast, confirm } = useFeedback();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [tag, setTag] = useState<HighlightTag | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<NoteSort>("updated");
  const [renaming, setRenaming] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Remember the sort choice per browser (a convenience, not data).
  useEffect(() => {
    try {
      const s = localStorage.getItem(SORT_KEY);
      if (s === "updated" || s === "created" || s === "title") setSort(s);
    } catch {}
  }, []);
  const changeSort = (s: NoteSort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {}
  };

  // "/" focuses search (unless typing somewhere already).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !el.closest("input, textarea, [contenteditable=true]")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const folder = folders?.find((f) => f.id === folderParam);
  const filtering = Boolean(deferredQuery.trim() || tag || pinnedOnly || favoritesOnly);

  const visible = useMemo(
    () => (notes ? filterNotes(notes, { text: deferredQuery, tag, folder: folderParam, pinnedOnly, favoritesOnly, trash, sort }) : undefined),
    [notes, deferredQuery, tag, folderParam, pinnedOnly, favoritesOnly, trash, sort],
  );
  const stats = useMemo(
    () => (notes && cards && reviews && quizzes ? computeStats(notes, cards, reviews, quizzes) : null),
    [notes, cards, reviews, quizzes],
  );
  const activeNotes = notes?.filter((n) => n.deletedAt === undefined) ?? [];
  const pinned = home && !filtering ? filterNotes(activeNotes, { pinnedOnly: true, sort: "updated" }) : [];

  const newNote = async (record = false) => {
    const note = await createNote({
      folderId: folder?.id,
      ...(record ? { title: `Lecture ${new Date().toLocaleDateString()}` } : {}),
    });
    router.push(`/note?id=${note.id}${record ? "&record=1" : ""}`);
  };

  const clearFilters = () => {
    setQuery("");
    setTag(null);
    setPinnedOnly(false);
    setFavoritesOnly(false);
  };

  const removeFolder = async () => {
    if (!folder) return;
    const ok = await confirm({
      title: `Delete subject "${folder.name}"?`,
      description: "Its notes and flashcards are kept and move to Unfiled.",
      confirmLabel: "Delete subject",
      destructive: true,
    });
    if (ok) {
      await deleteFolder(folder.id);
      toast({ title: "Subject deleted. Its notes are now in Unfiled." });
      router.push("/");
    }
  };

  const doEmptyTrash = async () => {
    const ok = await confirm({
      title: "Empty Trash?",
      description: "All notes in Trash will be permanently deleted. This can't be undone.",
      confirmLabel: "Empty Trash",
      destructive: true,
    });
    if (ok) toast({ title: `Deleted ${await emptyTrash()} notes permanently` });
  };

  if (!notes || !folders) return <div className="px-4 py-10" aria-busy="true" />;

  const firstRun = activeNotes.length === 0 && home && notes.length === 0;
  const heading = trash ? "Trash" : folderParam === "unfiled" ? "Unfiled notes" : folder ? folder.name : "My notes";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{home ? "Welcome back" : heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {trash
              ? "Notes in Trash are hidden everywhere else. Restore them or delete them permanently."
              : home
                ? "Capture lectures, highlight what matters, then practise until it sticks."
                : `${visible?.length ?? 0} ${visible?.length === 1 ? "note" : "notes"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folder && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
                <Pencil className="h-4 w-4" /> Rename
              </Button>
              <Button variant="ghost" size="sm" onClick={removeFolder}>
                <Trash2 className="h-4 w-4" /> Delete subject
              </Button>
            </>
          )}
          {trash ? (
            <Button variant="outline" onClick={doEmptyTrash} disabled={!visible?.length}>
              <Trash2 className="h-4 w-4" /> Empty Trash
            </Button>
          ) : (
            <Button onClick={() => newNote()}>
              <Plus className="h-4 w-4" /> New note
            </Button>
          )}
        </div>
      </div>

      {firstRun ? (
        <FirstRun onNew={() => newNote()} onRecord={() => newNote(true)} />
      ) : (
        <>
          {home && stats && (
            <>
              {/* Quick actions */}
              <div className="mb-6 grid gap-2 sm:grid-cols-3">
                <QuickAction icon={Mic} label="Record a lecture" detail="Transcribed on this device" onClick={() => newNote(true)} />
                <QuickAction
                  icon={Layers}
                  label="Review flashcards"
                  detail={stats.dueToday ? `${stats.dueToday} due today` : stats.totalCards ? "Nothing due today" : "No cards yet"}
                  href={stats.totalCards ? "/flashcards/review" : "/flashcards"}
                />
                <QuickAction icon={GraduationCap} label="Study" detail="Quizzes and AI explanations" href="/study" />
              </div>

              {/* Real numbers only */}
              <dl className="mb-8 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatTile label="Notes" value={stats.totalNotes} detail={`${stats.notesCreatedThisWeek} created in the last 7 days`} />
                <StatTile label="Cards due today" value={stats.dueToday} detail={`of ${stats.totalCards} flashcards`} />
                <StatTile label="Reviews this week" value={stats.reviewsThisWeek} detail="Flashcard ratings, last 7 days" />
                <StatTile
                  label="Quiz accuracy"
                  value={stats.quizAccuracy === null ? "—" : `${Math.round(stats.quizAccuracy * 100)}%`}
                  detail={stats.quizzesTaken ? `Across ${stats.quizzesTaken} quizzes` : "No quizzes taken yet"}
                />
              </dl>

              {pinned.length > 0 && (
                <section className="mb-8" aria-labelledby="pinned-heading">
                  <h2 id="pinned-heading" className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Pin className="h-4 w-4" /> Pinned
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pinned.slice(0, 6).map((n) => (
                      <NoteCard key={n.id} note={n} folders={folders} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* Toolbar */}
          <section aria-labelledby="notes-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="notes-heading" className="text-sm font-semibold">
                {home ? "All notes" : trash ? "Trashed notes" : "Notes"}
              </h2>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="sr-only">Sort by</span>
                <Select value={sort} onChange={(e) => changeSort(e.target.value as NoteSort)} className="h-8 w-auto text-xs">
                  <option value="updated">Recently edited</option>
                  <option value="created">Recently created</option>
                  <option value="title">Title A–Z</option>
                </Select>
              </label>
            </div>

            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                  placeholder="Search titles and content  ( / )"
                  aria-label="Search notes"
                  className="h-9 w-full rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0">
                {HIGHLIGHT_ORDER.map((t) => (
                  <Chip key={t} active={tag === t} activeClass={HIGHLIGHT_STYLES[t].chip} onClick={() => setTag(tag === t ? null : t)}>
                    {HIGHLIGHTS[t].icon} {HIGHLIGHTS[t].short}
                  </Chip>
                ))}
                {!trash && (
                  <>
                    <Chip active={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)}>
                      <Pin className="h-3.5 w-3.5" /> Pinned
                    </Chip>
                    <Chip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
                      <Star className="h-3.5 w-3.5" /> Favorites
                    </Chip>
                  </>
                )}
              </div>
            </div>

            {visible && visible.length === 0 ? (
              <div className="rounded-lg border border-dashed px-6 py-12 text-center">
                <p className="font-medium">{filtering ? "No notes match these filters" : trash ? "Trash is empty" : "No notes here yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filtering
                    ? "Try a different word, or clear the filters."
                    : trash
                      ? "Deleted notes appear here and can be restored."
                      : "Create a note, or move existing notes here from their card menu."}
                </p>
                {filtering && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible?.map((n) => (
                  <NoteCard key={n.id} note={n} folders={folders} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <FolderDialog open={renaming} onClose={() => setRenaming(false)} folder={folder} />
    </div>
  );
}

function Chip({ active, onClick, activeClass, children }: { active: boolean; onClick: () => void; activeClass?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? cn("border-transparent", activeClass ?? "bg-foreground text-background") : "hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  detail,
  href,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  detail: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function FirstRun({ onNew, onRecord }: { onNew: () => void; onRecord: () => void }) {
  const steps = [
    { title: "Capture", body: "Type notes or record a lecture. Transcription runs on your device." },
    { title: "Highlight", body: "Mark 📚 exam, 💼 interview and 💡 key-concept points." },
    { title: "Practise", body: "Turn highlights into flashcards and quizzes, then review when they're due." },
  ];
  return (
    <div className="rounded-xl border bg-card p-6 sm:p-10">
      <h2 className="text-lg font-semibold">Start your first note</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Everything is saved in this browser and works offline. Download a backup from Settings any time.
      </p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-lg bg-muted/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">Step {i + 1}</p>
            <p className="mt-1 font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onNew}>
          <Plus className="h-4 w-4" /> New note
        </Button>
        <Button variant="outline" onClick={onRecord}>
          <Mic className="h-4 w-4" /> Record a lecture
        </Button>
        <Link href="/settings#import" className={buttonVariants({ variant: "ghost" })}>
          <Upload className="h-4 w-4" /> Import notes
        </Link>
        <Button variant="ghost" onClick={() => loadSampleData({ force: true })}>
          <Sparkles className="h-4 w-4" /> Load sample notes
        </Button>
      </div>
    </div>
  );
}
