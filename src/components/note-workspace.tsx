"use client";

import { BubbleMenu, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import {
  ArrowLeft,
  Check,
  Download,
  Globe,
  Layers,
  ListFilter,
  Maximize2,
  Mic,
  Minimize2,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Printer,
  Share2,
  Sparkles,
  Star,
  Trash2,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { HighlightButtons } from "@/components/editor/highlight-buttons";
import { HighlightExtractor } from "@/components/editor/highlight-extractor";
import { RecorderPanel } from "@/components/editor/recorder-panel";
import { useSmartEditor } from "@/components/editor/use-smart-editor";
import { ShareDialog } from "@/components/share-dialog";
import { AIPanel } from "@/components/study/ai-panel";
import { HighlightCardsDialog } from "@/components/study/highlight-cards-dialog";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { useFolders } from "@/hooks/use-data";
import { useOnline } from "@/hooks/use-online";
import { db, type Note } from "@/lib/db";
import { downloadText, safeFilename } from "@/lib/download";
import { extractHighlights, tagsIn } from "@/lib/highlights";
import { docToMarkdown } from "@/lib/markdown";
import { moveToFolder, restoreNote, setFavorite, setPinned, trashNote } from "@/lib/notes";
import { journalClear, journalWrite } from "@/lib/save-journal";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 400;
type SideTab = "highlights" | "ai";

export function NoteWorkspace({ note }: { note: Note }) {
  const router = useRouter();
  const params = useSearchParams();
  const folders = useFolders();
  const online = useOnline();
  const { toast } = useFeedback();

  const [title, setTitle] = useState(note.title);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [mobileSide, setMobileSide] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>("highlights");
  const [recorderOpen, setRecorderOpen] = useState(params.get("record") === "1");
  const [focusMode, setFocusMode] = useState(false);

  const pending = useRef<Partial<Note>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const shareIdRef = useRef(note.shareId);
  shareIdRef.current = note.shareId;

  /** Writes pending changes now. Safe to call repeatedly; used on unmount, tab hide and before sharing. */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const changes = pending.current;
    pending.current = {};
    if (!Object.keys(changes).length) return;
    // Any edit to a published note marks it as needing a re-publish.
    const full = { ...changes, ...(shareIdRef.current ? { syncStatus: "pending" as const } : {}) };
    // Synchronous copy first, so an unload during the async IndexedDB write can't lose this edit.
    const at = Date.now();
    journalWrite(note.id, full, at);
    try {
      await db.notes.update(note.id, { ...full, updatedAt: at });
      journalClear(note.id, at);
      if (!Object.keys(pending.current).length) setSaveState("saved");
    } catch {
      // Put the changes back so the next attempt retries them instead of losing them.
      pending.current = { ...changes, ...pending.current };
      setSaveState("error");
    }
  }, [note.id]);

  const queueSave = (changes: Partial<Note>) => {
    pending.current = { ...pending.current, ...changes };
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  const editor = useSmartEditor({
    content: note.content as JSONContent,
    onUpdate: (ed: Editor) =>
      queueSave({
        content: ed.getJSON(),
        plainText: ed.getText({ blockSeparator: "\n" }).trim(),
        tags: tagsIn(extractHighlights(ed.state.doc)),
      }),
  });

  // Save on leaving the page, switching tabs/apps (mobile often never fires pagehide), and unmount.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  // Warn before closing the tab if a save failed.
  useEffect(() => {
    if (saveState !== "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // Focus mode hides app chrome; Esc leaves it.
  useEffect(() => {
    const root = document.documentElement;
    if (focusMode) root.setAttribute("data-focus", "");
    else root.removeAttribute("data-focus");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && focusMode && setFocusMode(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.removeAttribute("data-focus");
    };
  }, [focusMode]);

  // Ctrl+S: save immediately (and stop the browser's "save page" dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  const exportMarkdown = async () => {
    await flush();
    downloadText(safeFilename(title || "note", "md"), docToMarkdown(editor?.getJSON() ?? note.content, title || "Untitled note"), "text/markdown");
  };

  const printNote = async () => {
    await flush();
    window.print();
  };

  const moveToTrash = async () => {
    await flush();
    await trashNote(note.id);
    toast({ title: `Moved "${title || "Untitled note"}" to Trash`, action: { label: "Undo", onClick: () => restoreNote(note.id) } });
    router.push("/");
  };

  const openSide = (tab: SideTab) => {
    setSideTab(tab);
    setSideOpen(true);
    setMobileSide(true);
  };

  const status =
    saveState === "error" ? (
      <span className="text-destructive">Not saved. Retrying on next change.</span>
    ) : saveState === "saving" ? (
      "Saving…"
    ) : (
      <>
        {online ? <Check className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {online ? "Saved locally" : "Offline · saved on this device"}
      </>
    );

  return (
    <div className={cn("mx-auto px-4 py-3 sm:px-6", focusMode ? "max-w-3xl" : "max-w-7xl")}>
      {/* Header */}
      <div className="mb-1 flex items-center gap-1.5" data-no-print>
        {!focusMode && (
          <Link href="/" className="rounded-md p-2 hover:bg-accent" aria-label="Back to notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <span role="status" className="mr-auto inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          {status}
        </span>

        <IconToggle label={note.pinned ? "Unpin note" : "Pin note"} active={note.pinned === 1} onClick={() => setPinned(note.id, !note.pinned)} icon={Pin} />
        <IconToggle
          label={note.favorite ? "Remove from favorites" : "Add to favorites"}
          active={note.favorite === 1}
          onClick={() => setFavorite(note.id, !note.favorite)}
          icon={Star}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setFocusMode((f) => !f)}
          aria-pressed={focusMode}
          aria-label={focusMode ? "Exit focus mode (Esc)" : "Focus mode"}
          title={focusMode ? "Exit focus mode (Esc)" : "Focus mode"}
        >
          {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        {!focusMode && (
          <Button size="sm" variant={note.shareId ? "secondary" : "outline"} onClick={() => setShareOpen(true)} className="hidden sm:inline-flex">
            {note.shareId ? <Globe className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {note.shareId ? "Shared" : "Share"}
          </Button>
        )}
        <Menu
          label="More note actions"
          trigger={<MoreHorizontal className="h-4 w-4" />}
          items={[
            { label: "Share…", icon: Share2, onSelect: () => setShareOpen(true) },
            { label: "Flashcards from highlights", icon: Layers, onSelect: () => setCardsOpen(true) },
            { label: "Export as Markdown", icon: Download, onSelect: exportMarkdown },
            { label: "Print / save as PDF", icon: Printer, onSelect: printNote },
            { label: "Move to Trash", icon: Trash2, onSelect: moveToTrash, destructive: true },
          ]}
        />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queueSave({ title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.commands.focus("start");
            }
          }}
          placeholder="Untitled note"
          aria-label="Note title"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 sm:text-3xl"
        />
        {!focusMode && folders && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground" data-no-print>
            <span className="sr-only">Subject</span>
            <Select value={note.folderId ?? ""} onChange={(e) => moveToFolder(note.id, e.target.value || undefined)} className="h-8 w-auto max-w-48 text-xs">
              <option value="">Unfiled</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      {editor && (
        <div className={cn("grid gap-6", sideOpen && !focusMode && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
          <section className="min-w-0" aria-label="Editor">
            <div data-no-print>
              <EditorToolbar
                editor={editor}
                trailing={
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant={recorderOpen ? "secondary" : "default"} onClick={() => setRecorderOpen((o) => !o)} aria-expanded={recorderOpen}>
                      <Mic className="h-4 w-4" /> <span className="hidden sm:inline">Record</span>
                    </Button>
                    {!focusMode && (
                      <>
                        <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => openSide("highlights")} aria-label="Highlights">
                          <ListFilter className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => openSide("ai")} aria-label="AI assistant">
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hidden lg:inline-flex"
                          onClick={() => setSideOpen((o) => !o)}
                          aria-label={sideOpen ? "Hide side panel" : "Show side panel"}
                          aria-expanded={sideOpen}
                        >
                          {sideOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                }
              />
            </div>
            {/* Stable wrapper: BubbleMenu moves its own DOM node, so React must never insert siblings next to it. */}
            <div>{recorderOpen && <RecorderPanel editor={editor} onClose={() => setRecorderOpen(false)} />}</div>
            <BubbleMenu
              editor={editor}
              shouldShow={({ editor: ed, state }) => ed.isEditable && !state.selection.empty}
              className="rounded-lg border bg-popover p-1 shadow-lg"
            >
              <HighlightButtons editor={editor} compact />
            </BubbleMenu>
            <EditorContent editor={editor} />
          </section>

          {!focusMode && (sideOpen || mobileSide) && (
            <aside
              data-no-print
              aria-label="Side panel"
              className={cn(
                "lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:pl-6",
                mobileSide ? "order-first rounded-lg border p-4 lg:order-none lg:rounded-none lg:border-y-0 lg:border-r-0 lg:p-0 lg:pl-6" : "hidden",
                !sideOpen && "lg:hidden",
              )}
            >
              <div role="tablist" aria-label="Side panel" className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
                {(
                  [
                    ["highlights", "Highlights", ListFilter],
                    ["ai", "AI assistant", Sparkles],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={sideTab === id}
                    onClick={() => setSideTab(id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
                      sideTab === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
                <button type="button" onClick={() => setMobileSide(false)} className="rounded-md px-2 text-sm text-muted-foreground lg:hidden" aria-label="Close panel">
                  ✕
                </button>
              </div>
              <div role="tabpanel">
                {sideTab === "highlights" ? <HighlightExtractor editor={editor} /> : <AIPanel note={{ ...note, title }} editor={editor} />}
              </div>
            </aside>
          )}
        </div>
      )}

      <ShareDialog note={{ ...note, title }} open={shareOpen} onClose={() => setShareOpen(false)} beforeShare={flush} />
      <HighlightCardsDialog
        note={cardsOpen && editor ? { ...note, title, content: editor.getJSON() } : note}
        open={cardsOpen}
        onClose={() => setCardsOpen(false)}
      />
    </div>
  );
}

function IconToggle({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon: typeof Pin }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn("rounded-md p-2 hover:bg-accent", active ? "text-foreground" : "text-muted-foreground")}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current", active && Icon === Star && "fill-amber-400 text-amber-500")} />
    </button>
  );
}
