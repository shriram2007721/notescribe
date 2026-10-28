"use client";

import type { Editor } from "@tiptap/react";
import { Bold, Heading2, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HighlightButtons } from "./highlight-buttons";

export function EditorToolbar({ editor, trailing }: { editor: Editor; trailing?: ReactNode }) {
  const fmt = [
    { icon: Bold, label: "Bold", active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, label: "Italic", active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    {
      icon: Heading2,
      label: "Heading",
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    { icon: List, label: "Bullet list", active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    {
      icon: ListOrdered,
      label: "Numbered list",
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    { icon: Undo2, label: "Undo", active: false, run: () => editor.chain().focus().undo().run() },
    { icon: Redo2, label: "Redo", active: false, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b bg-background/95 px-1 py-2 backdrop-blur">
      {/* Only the formatting buttons scroll on narrow screens; the trailing actions stay visible. */}
      <div role="toolbar" aria-label="Formatting" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {fmt.map(({ icon: Icon, label, active, run }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active}
          onClick={run}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent",
            active && "bg-accent text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <div className="mx-1 h-6 w-px shrink-0 bg-border" />
      <HighlightButtons editor={editor} />
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
