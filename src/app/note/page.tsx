"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { NoteWorkspace } from "@/components/note-workspace";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { restoreNote } from "@/lib/notes";
import { recoverOnce } from "@/lib/save-journal";

export default function NotePage() {
  return (
    <Suspense>
      <NoteLoader />
    </Suspense>
  );
}

function NoteLoader() {
  const id = useSearchParams().get("id");
  // Apply any edit journaled before an abrupt unload before the editor reads the note.
  const [recovered, setRecovered] = useState(false);
  useEffect(() => {
    recoverOnce().then(() => setRecovered(true));
  }, []);
  if (!recovered) return <div className="px-4 py-10" aria-busy="true" />;
  return <NoteById id={id} />;
}

function NoteById({ id }: { id: string | null }) {
  // null = not found, undefined = still loading
  const note = useLiveQuery(() => (id ? db.notes.get(id).then((n) => n ?? null) : null), [id]);

  if (note === undefined) return <div className="px-4 py-10" aria-busy="true" />;
  if (note === null) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-medium">Note not found on this device.</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted permanently, or it was created in another browser.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-primary underline">
          Back to my notes
        </Link>
      </div>
    );
  }
  if (note.deletedAt !== undefined) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-medium">“{note.title || "Untitled note"}” is in Trash.</p>
        <p className="mt-1 text-sm text-muted-foreground">Restore it to view and edit it.</p>
        <Button className="mt-4" onClick={() => restoreNote(note.id)}>
          <RotateCcw className="h-4 w-4" /> Restore note
        </Button>
      </div>
    );
  }
  return <NoteWorkspace key={note.id} note={note} />;
}
