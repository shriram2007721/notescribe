"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NoteWorkspace } from "@/components/note-workspace";
import { db } from "@/lib/db";

export default function NotePage() {
  return (
    <Suspense>
      <NoteLoader />
    </Suspense>
  );
}

function NoteLoader() {
  const id = useSearchParams().get("id");
  // null = not found, undefined = still loading
  const note = useLiveQuery(() => (id ? db.notes.get(id).then((n) => n ?? null) : null), [id]);

  if (note === undefined) return null;
  if (note === null) {
    return (
      <main className="container py-16 text-center">
        <p className="font-medium">Note not found on this device.</p>
        <Link href="/" className="text-sm text-primary underline">
          Back to my notes
        </Link>
      </main>
    );
  }
  return <NoteWorkspace key={note.id} note={note} />;
}
