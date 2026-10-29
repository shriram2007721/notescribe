import type { Node as PMNode } from "@tiptap/pm/model";
import type { HighlightTag } from "@/lib/db";

/* ------------------------------------------------------------------ */
/* Tag registry: the default tags plus any the user adds. Stored in   */
/* this browser (localStorage) so highlights keep their look.         */
/* ------------------------------------------------------------------ */

export interface TagDef {
  id: HighlightTag;
  label: string;
  short: string;
  icon: string;
  /** Hue (0–360) used for the highlight colour. */
  hue: number;
}

export const TAG_HUES = [45, 150, 215, 0, 280, 25, 330, 180];

export const DEFAULT_TAGS: TagDef[] = [
  { id: "exam", label: "Exam Important", short: "Exam", icon: "📚", hue: 45 },
  { id: "interview", label: "Interview Important", short: "Interview", icon: "💼", hue: 150 },
  { id: "concept", label: "Key Concept", short: "Concept", icon: "💡", hue: 215 },
];

const KEY = "notescribe.tags";

function load(): TagDef[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as TagDef[] | null;
    if (Array.isArray(parsed) && parsed.length && parsed.every((t) => t.id && t.label)) return parsed;
  } catch {
    /* unreadable storage: fall back to the defaults */
  }
  return DEFAULT_TAGS;
}

// Starts with the defaults so server and first client render match; loadTags() runs after mount.
let registry: TagDef[] = DEFAULT_TAGS;

/** Reads the saved tags from this browser. Call once after the first render. */
export function loadTags() {
  registry = load();
}

/** Tags in the order they are shown. */
export const getTags = () => registry;
export const tagOrder = (): HighlightTag[] => registry.map((t) => t.id);

/** Info for any tag id, including ones that were removed from the registry. */
export function tagInfo(id: HighlightTag): TagDef {
  return registry.find((t) => t.id === id) ?? { id, label: id, short: id, icon: "🏷️", hue: 0 };
}

/** Saves the tag list. The caller should reload so editors pick up the new tags. */
export function saveTags(tags: TagDef[]) {
  registry = tags;
  localStorage.setItem(KEY, JSON.stringify(tags));
}

export function resetTags() {
  localStorage.removeItem(KEY);
  registry = DEFAULT_TAGS;
}

/** Highlight background and chip colours for a tag. */
export const tagFill = (id: HighlightTag, alpha = 0.5) => `hsl(${tagInfo(id).hue} 85% 70% / ${alpha})`;
export const tagBorder = (id: HighlightTag) => `hsl(${tagInfo(id).hue} 65% 45%)`;

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

/** Tags that appear in the given highlights, in the registry's order (unknown tags last). */
export function tagsIn(highlights: ExtractedHighlight[]): HighlightTag[] {
  const found = new Set(highlights.map((h) => h.tag));
  const known = tagOrder().filter((t) => found.has(t));
  return [...known, ...Array.from(found).filter((t) => !known.includes(t))];
}
