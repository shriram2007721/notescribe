"use client";

import { FileText, GraduationCap, Layers, Mic, Moon, Plus, Search, Settings, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAllNotes } from "@/hooks/use-data";
import { createNote, filterNotes } from "@/lib/notes";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const notes = useAllNotes();
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = "palette-list";

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setActive(0);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const go = (href: string) => () => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      {
        id: "new",
        label: "New note",
        icon: Plus,
        run: async () => {
          onClose();
          const n = await createNote();
          router.push(`/note?id=${n.id}`);
        },
      },
      {
        id: "record",
        label: "Record a lecture",
        hint: "New note with the recorder open",
        icon: Mic,
        run: async () => {
          onClose();
          const n = await createNote({ title: `Lecture ${new Date().toLocaleDateString()}` });
          router.push(`/note?id=${n.id}&record=1`);
        },
      },
      { id: "review", label: "Review flashcards", icon: Layers, run: go("/flashcards/review") },
      { id: "study", label: "Study: quiz & AI assistant", icon: GraduationCap, run: go("/study") },
      { id: "community", label: "Community", icon: Users, run: go("/community") },
      { id: "settings", label: "Settings, export & backup", icon: Settings, run: go("/settings") },
      { id: "theme", label: "Toggle dark mode", icon: Moon, run: () => toggle() },
    ];
    const q = deferred.trim().toLowerCase();
    const matchingActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
    const matchingNotes = notes
      ? filterNotes(notes, { text: q })
          .slice(0, 8)
          .map<Item>((n) => ({
            id: `note-${n.id}`,
            label: n.title || "Untitled note",
            hint: n.plainText.slice(0, 80),
            icon: FileText,
            run: go(`/note?id=${n.id}`),
          }))
      : [];
    return q ? [...matchingNotes, ...matchingActions] : [...matchingActions, ...matchingNotes];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, notes]);

  useEffect(() => setActive(0), [deferred]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Search notes and commands"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes or type a command…"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
            />
            <kbd className="rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>
          <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No notes or commands match “{deferred}”.</li>}
            {items.map((item, i) => (
              <li
                key={item.id}
                id={`cmd-${item.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={item.run}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm", i === active && "bg-accent")}
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </dialog>
  );
}
