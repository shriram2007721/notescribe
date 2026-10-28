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

interface JSONNode {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: JSONNode[];
}

export interface JSONHighlight {
  tag: HighlightTag;
  text: string;
  /** The sentence containing the highlight, when one can be found. */
  sentence?: string;
}

/** Same as extractHighlights but works on stored TipTap JSON, without an editor instance. */
export function extractHighlightsFromJSON(doc: unknown): JSONHighlight[] {
  const out: JSONHighlight[] = [];

  const visitBlock = (children: JSONNode[]) => {
    let blockText = "";
    const runs: { tag: HighlightTag; start: number; end: number }[] = [];
    for (const child of children) {
      if (child.type !== "text" || !child.text) {
        if (child.type === "hardBreak") blockText += " ";
        continue;
      }
      const tag = child.marks?.find((m) => m.type === "smartHighlight")?.attrs?.tag as HighlightTag | undefined;
      const start = blockText.length;
      blockText += child.text;
      if (!tag) continue;
      const last = runs[runs.length - 1];
      if (last && last.tag === tag && last.end === start) last.end = blockText.length;
      else runs.push({ tag, start, end: blockText.length });
    }
    for (const r of runs) {
      const text = blockText.slice(r.start, r.end).trim();
      if (!text) continue;
      out.push({ tag: r.tag, text, sentence: sentenceAround(blockText, r.start, r.end) });
    }
  };

  const walk = (node: JSONNode) => {
    const children = node.content ?? [];
    if (children.some((c) => c.type === "text")) visitBlock(children);
    else children.forEach(walk);
  };

  if (doc && typeof doc === "object") walk(doc as JSONNode);
  return out;
}

function sentenceAround(text: string, start: number, end: number) {
  const before = text.slice(0, start);
  const sStart = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "));
  const after = text.slice(end);
  const m = after.search(/[.?!](\s|$)/);
  const sEnd = m === -1 ? text.length : end + m + 1;
  return text.slice(sStart === -1 ? 0 : sStart + 2, sEnd).trim();
}

export function tagsIn(highlights: ExtractedHighlight[]): HighlightTag[] {
  return HIGHLIGHT_ORDER.filter((t) => highlights.some((h) => h.tag === t));
}
