"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { importBackup, MAX_BACKUP_BYTES, parseBackup, type Backup } from "@/lib/backup";
import { db } from "@/lib/db";
import { noteFromMarkdown } from "@/lib/markdown";
import { createNote } from "@/lib/notes";

type Preview =
  | { kind: "backup"; backup: Backup; fileName: string }
  | { kind: "markdown"; notes: { title: string; plainText: string; fields: ReturnType<typeof noteFromMarkdown> }[]; errors: string[] };

const MAX_MD_BYTES = 2 * 1024 * 1024;

/** Import a JSON backup or Markdown files, always with a preview; never overwrites existing notes. */
export function ImportPanel() {
  const { toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: FileList | null) => {
    setError(null);
    if (!files?.length) return;
    const list = Array.from(files);
    try {
      if (list.length === 1 && /\.json$/i.test(list[0].name)) {
        const f = list[0];
        if (f.size > MAX_BACKUP_BYTES) return setError("That backup is larger than 25 MB.");
        const parsed = parseBackup(await f.text());
        if (!parsed.ok) return setError(parsed.error);
        setPreview({ kind: "backup", backup: parsed.backup, fileName: f.name });
        return;
      }
      const errors: string[] = [];
      const notes: Extract<Preview, { kind: "markdown" }>["notes"] = [];
      for (const f of list) {
        if (!/\.(md|markdown|txt)$/i.test(f.name)) {
          errors.push(`${f.name}: not a Markdown or text file`);
          continue;
        }
        if (f.size > MAX_MD_BYTES) {
          errors.push(`${f.name}: larger than 2 MB`);
          continue;
        }
        const fields = noteFromMarkdown(await f.text(), f.name.replace(/\.(md|markdown|txt)$/i, ""));
        notes.push({ title: fields.title, plainText: fields.plainText, fields });
      }
      if (!notes.length) return setError(errors.join("; ") || "No importable files selected.");
      setPreview({ kind: "markdown", notes, errors });
    } catch {
      setError("Couldn't read that file.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      if (preview.kind === "backup") {
        const s = await importBackup(preview.backup);
        toast({ title: `Imported ${s.notes} notes, ${s.cards} flashcards and ${s.folders} subjects`, tone: "success" });
      } else {
        await db.transaction("rw", db.notes, async () => {
          for (const n of preview.notes) await createNote(n.fields);
        });
        toast({ title: `Imported ${preview.notes.length} notes`, tone: "success" });
      }
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error && e.name === "QuotaExceededError" ? "Not enough storage space to import." : "Import failed. Nothing was changed.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept=".json,.md,.markdown,.txt" multiple className="sr-only" id="import-file" onChange={(e) => onFiles(e.target.files)} />
      <Button variant="outline" onClick={() => input.current?.click()}>
        <FileUp className="h-4 w-4" /> Choose files…
      </Button>
      <p className="text-xs text-muted-foreground">A NoteScribe JSON backup, or one or more Markdown (.md) files. Imported items are added as new copies.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Import preview"
        description="Nothing has been imported yet."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={busy}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </>
        }
      >
        {preview?.kind === "backup" && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium">{preview.fileName}</span>, exported {new Date(preview.backup.exportedAt).toLocaleString()}
            </p>
            <ul className="grid grid-cols-2 gap-2">
              <li className="rounded border p-2">{preview.backup.notes.length} notes</li>
              <li className="rounded border p-2">{preview.backup.folders.length} subjects</li>
              <li className="rounded border p-2">{preview.backup.cards.length} flashcards</li>
              <li className="rounded border p-2">{preview.backup.quizAttempts.length} quiz results</li>
            </ul>
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-muted-foreground">
              {preview.backup.notes.slice(0, 30).map((n) => (
                <li key={n.id}>{n.title || "Untitled note"}</li>
              ))}
              {preview.backup.notes.length > 30 && <li>…and {preview.backup.notes.length - 30} more</li>}
            </ul>
            <p className="text-xs text-muted-foreground">Everything is added alongside your existing data; nothing is replaced.</p>
          </div>
        )}
        {preview?.kind === "markdown" && (
          <div className="space-y-3 text-sm">
            <ul className="space-y-2">
              {preview.notes.map((n, i) => (
                <li key={i} className="rounded border p-2">
                  <p className="font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-muted-foreground">{n.plainText || "(empty)"}</p>
                </li>
              ))}
            </ul>
            {preview.errors.length > 0 && <p className="text-destructive">Skipped: {preview.errors.join("; ")}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
