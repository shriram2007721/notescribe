"use client";

import type { Editor } from "@tiptap/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { HighlightTag } from "@/lib/db";
import { extractHighlights, tagBorder, tagFill, tagInfo, tagOrder, type ExtractedHighlight } from "@/lib/highlights";
import { cn } from "@/lib/utils";

type Filter = "all" | HighlightTag;

export function HighlightExtractor({ editor, className }: { editor: Editor; className?: string }) {
  const [items, setItems] = useState<ExtractedHighlight[]>(() => extractHighlights(editor.state.doc));
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(extractHighlights(editor.state.doc));
    refresh();
    editor.on("update", refresh);
    return () => {
      editor.off("update", refresh);
    };
  }, [editor]);

  const visible = filter === "all" ? items : items.filter((h) => h.tag === filter);
  const count = (t: HighlightTag) => items.filter((h) => h.tag === t).length;

  const jumpTo = (h: ExtractedHighlight) => {
    editor.chain().setTextSelection({ from: h.from, to: h.to }).scrollIntoView().run();
    editor.view.focus();
  };

  const copyList = async () => {
    const text = visible.map((h) => `- ${tagInfo(h.tag).icon} ${h.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; nothing useful to do */
    }
  };

  return (
    <aside className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Highlight extractor</h2>
        <button
          type="button"
          onClick={copyList}
          disabled={!visible.length}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy list"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter highlights">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="opacity-60">{items.length}</span>
        </FilterChip>
        {tagOrder().map((t) => (
          <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)} activeFill={tagFill(t, 0.45)}>
            {tagInfo(t).icon} {tagInfo(t).short} <span className="opacity-60">{count(t)}</span>
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          {items.length === 0
            ? "Select text and pick 📚 💼 or 💡 to start building your revision list."
            : `No ${filter !== "all" ? tagInfo(filter).label : ""} points yet.`}
        </p>
      ) : (
        <ol className="space-y-2">
          {visible.map((h) => (
            <li key={`${h.from}-${h.tag}`}>
              <button
                type="button"
                onClick={() => jumpTo(h)}
                className={cn(
                  "w-full rounded-md border border-l-4 bg-card p-2.5 text-left text-sm leading-snug hover:bg-accent",
                )}
                style={{ borderLeftColor: tagBorder(h.tag) }}
              >
                <span className="mr-1" aria-label={tagInfo(h.tag).label}>
                  {tagInfo(h.tag).icon}
                </span>
                {h.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function FilterChip({
  active,
  onClick,
  activeFill,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Background colour when active; defaults to the foreground colour. */
  activeFill?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={active && activeFill ? { backgroundColor: activeFill } : undefined}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? (activeFill ? "border-transparent" : "border-transparent bg-foreground text-background") : "hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
