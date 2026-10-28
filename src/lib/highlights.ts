import type { Node as PMNode } from "@tiptap/pm/model";
import type { HighlightTag } from "@/lib/db";

export const HIGHLIGHTS: Record<HighlightTag, { label: string; short: string; icon: string; shortcut: string }> = {
  exam: { label: "Exam Important", short: "Exam", icon: "📚", shortcut: "Mod-Alt-1" },
  interview: { label: "Interview Important", short: "Interview", icon: "💼", shortcut: "Mod-Alt-2" },
  concept: { label: "Key Concept", short: "Concept", icon: "💡", shortcut: "Mod-Alt-3" },
};

export const HIGHLIGHT_ORDER: HighlightTag[] = ["exam", "interview", "concept"];

/** Tailwind classes per tag; kept as literals so Tailwind can see them. */
export const HIGHLIGHT_STYLES: Record<HighlightTag, { chip: string; border: string }> = {
  exam: { chip: "bg-exam/40", border: "border-l-exam" },
  interview: { chip: "bg-interview/40", border: "border-l-interview" },
  concept: { chip: "bg-concept/40", border: "border-l-concept" },
};

export interface ExtractedHighlight {
  tag: HighlightTag;
  text: string;
  from: number;
  to: number;
}

/** Walks the document and returns each contiguous highlighted run, in reading order. */
export function extractHighlights(doc: PMNode): ExtractedHighlight[] {
  const out: ExtractedHighlight[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let current: ExtractedHighlight | null = null;

    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      const tag = child.marks.find((m) => m.type.name === "smartHighlight")?.attrs.tag as HighlightTag | undefined;

      if (tag && child.isText) {
        if (current && current.tag === tag && current.to === start) {
          current.text += child.text;
          current.to = start + child.nodeSize;
        } else {
          if (current) out.push(current);
          current = { tag, text: child.text ?? "", from: start, to: start + child.nodeSize };
        }
      } else if (current) {
        out.push(current);
        current = null;
      }
    });

    if (current) out.push(current);
    return false;
  });

  return out.map((h) => ({ ...h, text: h.text.trim() })).filter((h) => h.text);
}

export function tagsIn(highlights: ExtractedHighlight[]): HighlightTag[] {
  return HIGHLIGHT_ORDER.filter((t) => highlights.some((h) => h.tag === t));
}
