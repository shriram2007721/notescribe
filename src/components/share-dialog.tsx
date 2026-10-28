"use client";

import { Check, Copy, Globe, Link2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { db, getSetting, setSetting, type Note } from "@/lib/db";
import { buildShareUrl, publishNote, unpublishNote } from "@/lib/share";

export function ShareDialog({
  note,
  open,
  onClose,
  beforeShare,
}: {
  note: Note;
  open: boolean;
  onClose: () => void;
  /** Flush unsaved editor changes so what's shared matches what's on screen. */
  beforeShare: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [author, setAuthor] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setLink(null);
      getSetting("authorName", "").then(setAuthor);
    } else if (!open && d.open) d.close();
  }, [open]);

  // Always read the latest saved copy so we share the flushed content.
  const latest = async () => {
    await beforeShare();
    return (await db.notes.get(note.id)) ?? note;
  };

  const makeLink = async () => {
    const n = await latest();
    setLink(buildShareUrl(n, author || undefined));
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const publish = async () => {
    setBusy(true);
    await setSetting("authorName", author);
    await publishNote(await latest(), author);
    setBusy(false);
  };

  const unpublish = async () => {
    setBusy(true);
    await unpublishNote(note);
    setBusy(false);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Share note</h2>
            <p className="text-sm text-muted-foreground">&ldquo;{note.title || "Untitled note"}&rdquo;</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Display name</span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Anonymous"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" /> Public link
          </h3>
          <p className="text-xs text-muted-foreground">
            The note is packed into the link itself, so anyone with it can open a read-only copy. No account or server needed.
          </p>
          {link ? (
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-md border bg-muted px-2 text-xs" />
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={makeLink}>
              Generate link
            </Button>
          )}
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" /> Community feed
          </h3>
          {note.shareId ? (
            <>
              <p className="text-xs text-muted-foreground">
                Published{note.sharedAt ? ` ${new Date(note.sharedAt).toLocaleString()}` : ""}.
                {note.syncStatus === "pending" && " You've edited it since publishing."}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={publish} disabled={busy}>
                  Update post
                </Button>
                <Button size="sm" variant="ghost" onClick={unpublish} disabled={busy}>
                  Unpublish
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Post this note so other students can learn from your highlights.</p>
              <Button size="sm" onClick={publish} disabled={busy}>
                Share to Community
              </Button>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Demo mode: the community feed is a local mock, so posts are saved on this device only.
          </p>
        </section>
      </div>
    </dialog>
  );
}
