"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Folder } from "@/lib/db";
import { createFolder, MAX_FOLDER_NAME, renameFolder } from "@/lib/folders";

/** Create a subject, or rename one when `folder` is given. */
export function FolderDialog({
  open,
  onClose,
  folder,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  folder?: Folder;
  onCreated?: (f: Folder) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useFeedback();

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? "");
      setError(null);
    }
  }, [open, folder]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (folder) {
        await renameFolder(folder.id, name);
        toast({ title: "Subject renamed", tone: "success" });
      } else {
        const f = await createFolder(name);
        toast({ title: `Created "${f.name}"`, tone: "success" });
        onCreated?.(f);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the subject.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={folder ? "Rename subject" : "New subject"} className="max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="folder-name">Name</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_FOLDER_NAME}
            placeholder="e.g. Operating Systems"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "folder-error" : undefined}
          />
          {error && (
            <p id="folder-error" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {folder ? "Rename" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
