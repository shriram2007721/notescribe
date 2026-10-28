"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useCards, useFolders } from "@/hooks/use-data";
import { dueCards, reviewCard } from "@/lib/cards";
import type { Flashcard, Rating } from "@/lib/db";
import { previewInterval } from "@/lib/srs";
import { cn } from "@/lib/utils";

const RATINGS: { rating: Rating; label: string; key: string; className: string }[] = [
  { rating: "again", label: "Again", key: "1", className: "border-destructive/50 hover:bg-destructive/10" },
  { rating: "hard", label: "Hard", key: "2", className: "hover:bg-accent" },
  { rating: "good", label: "Good", key: "3", className: "border-primary/50 hover:bg-primary/10" },
  { rating: "easy", label: "Easy", key: "4", className: "hover:bg-accent" },
];

export default function ReviewPage() {
  const cards = useCards();
  const folders = useFolders();
  const [folder, setFolder] = useState("");
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [ahead, setAhead] = useState(false);

  const available = useMemo(() => {
    const scoped = (cards ?? []).filter((c) => !folder || c.folderId === folder);
    return ahead ? [...scoped].sort((a, b) => a.due - b.due) : dueCards(scoped);
  }, [cards, folder, ahead]);

  if (!cards || !folders) return <div className="px-4 py-10" aria-busy="true" />;

  if (queue) return <Session initial={queue} onExit={() => setQueue(null)} />;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link href="/flashcards" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Flashcards
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {cards.length === 0 ? "You don't have any flashcards yet." : ahead ? `${available.length} cards, earliest due first.` : `${available.length} cards due today.`}
      </p>

      {cards.length > 0 && (
        <div className="mt-6 space-y-4 rounded-lg border bg-card p-5">
          <label className="flex items-center justify-between gap-3 text-sm">
            Subject
            <Select value={folder} onChange={(e) => setFolder(e.target.value)} className="w-56">
              <option value="">All subjects</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </label>
          {available.length > 0 ? (
            <Button className="w-full" onClick={() => setQueue(available)}>
              Start review ({available.length})
            </Button>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-green-600" /> Nothing due. Come back later, or review ahead of schedule.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setAhead(true)}>
                Review ahead
              </Button>
            </div>
          )}
          {ahead && <p className="text-xs text-muted-foreground">Reviewing ahead still updates each card&apos;s schedule.</p>}
        </div>
      )}
      {cards.length === 0 && (
        <Link href="/flashcards" className={buttonVariants({ className: "mt-6" })}>
          Create flashcards
        </Link>
      )}
    </div>
  );
}

function Session({ initial, onExit }: { initial: Flashcard[]; onExit: () => void }) {
  // Snapshot the queue so live DB updates don't reshuffle cards mid-session.
  const [queue, setQueue] = useState(initial);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [saving, setSaving] = useState(false);
  const total = useRef(initial.length);

  const card = queue[pos];
  const done = pos >= queue.length;

  const rate = async (rating: Rating) => {
    if (!card || saving) return;
    setSaving(true);
    const updated = await reviewCard(card, rating);
    setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
    // Forgotten cards come back at the end of this session.
    if (rating === "again") setQueue((q) => [...q, updated]);
    setPos((p) => p + 1);
    setRevealed(false);
    setSaving(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) rate(r.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Session complete</p>
        <p className="mt-1 text-3xl font-semibold">{total.current} cards reviewed</p>
        <p className="mt-1 text-sm text-muted-foreground">{reviewed} ratings recorded</p>
        <dl className="mx-auto mt-6 grid max-w-xs grid-cols-4 gap-2 text-center">
          {RATINGS.map((r) => (
            <div key={r.rating} className="rounded-lg border p-2">
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{tally[r.rating]}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex justify-center gap-2">
          <Button onClick={onExit}>Done</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            My notes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col px-4 py-6 sm:px-6 lg:min-h-screen">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> End session
        </button>
        <span aria-live="polite">
          {Math.min(pos + 1, queue.length)} / {queue.length}
        </span>
      </div>
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={pos}>
        <div className="h-full bg-primary transition-all" style={{ width: `${(pos / queue.length) * 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col rounded-xl border bg-card p-6 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</p>
        <p className="mt-2 whitespace-pre-line text-xl font-medium leading-snug">{card.front}</p>
        {revealed && (
          <div className="mt-8 border-t pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Answer</p>
            <p className="mt-2 whitespace-pre-line text-lg leading-relaxed">{card.back}</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        {!revealed ? (
          <Button className="h-12 w-full text-base" onClick={() => setRevealed(true)} autoFocus>
            Show answer <kbd className="ml-2 rounded border border-primary-foreground/30 px-1.5 text-xs">Space</kbd>
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.rating}
                type="button"
                disabled={saving}
                onClick={() => rate(r.rating)}
                className={cn("flex flex-col items-center rounded-lg border bg-background px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50", r.className)}
              >
                {r.label}
                <span className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {previewInterval(card, r.rating)} · {r.key}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
