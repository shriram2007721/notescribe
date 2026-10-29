"use client";

import type { Editor } from "@tiptap/react";
import { Eraser } from "lucide-react";
import { tagFill, tagInfo, tagOrder } from "@/lib/highlights";
import { cn } from "@/lib/utils";

export function HighlightButtons({ editor, compact = false }: { editor: Editor; compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {tagOrder().map((tag, i) => {
        const h = tagInfo(tag);
        const active = editor.isActive("smartHighlight", { tag });
        return (
          <button
            key={tag}
            type="button"
            title={`${h.label}${i < 9 ? ` (Ctrl+Alt+${i + 1})` : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleSmartHighlight(tag).run()}
            style={active ? { backgroundColor: tagFill(tag, 0.45) } : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-accent",
              active && "ring-1 ring-foreground/20",
            )}
          >
            <span aria-hidden>{h.icon}</span>
            {!compact && <span className="hidden 2xl:inline">{h.short}</span>}
          </button>
        );
      })}
      <button
        type="button"
        title="Remove highlight"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().unsetSmartHighlight().run()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
      >
        <Eraser className="h-4 w-4" />
      </button>
    </div>
  );
}
