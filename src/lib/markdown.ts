import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";
import { marked } from "marked";
import { baseExtensions } from "@/components/editor/extensions";
import type { HighlightTag } from "./db";
import { extractHighlightsFromJSON, tagOrder } from "./highlights";

/*
 * Markdown <-> TipTap JSON.
 * Smart highlights are written as inline HTML, <mark data-tag="exam">…</mark>, which standard Markdown
 * viewers display as highlighted text and which our importer turns back into the same highlight.
 */

type Node = JSONContent;
type Mark = NonNullable<Node["marks"]>[number];

const MARK_ORDER = ["smartHighlight", "bold", "italic", "strike", "code"];

const markKey = (m: Mark) => (m.type === "smartHighlight" ? `hl:${m.attrs?.tag}` : m.type);

function escapeText(s: string) {
  return s.replace(/([\\`*_[\]<])/g, "\\$1");
}

function wrap(inner: string, mark: Mark) {
  const lead = inner.match(/^\s*/)?.[0] ?? "";
  const trail = inner.match(/\s*$/)?.[0] ?? "";
  const core = inner.trim();
  if (!core) return inner;
  let open = "";
  let close = "";
  switch (mark.type) {
    case "smartHighlight":
      open = `<mark data-tag="${mark.attrs?.tag}">`;
      close = "</mark>";
      break;
    case "bold":
      open = close = "**";
      break;
    case "italic":
      open = close = "*";
      break;
    case "strike":
      open = close = "~~";
      break;
    default:
      return inner;
  }
  return `${lead}${open}${core}${close}${trail}`;
}

/** Renders inline nodes, grouping runs that share a mark so nesting stays valid Markdown. */
function renderInline(nodes: Node[], active: string[] = []): string {
  let out = "";
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    if (n.type === "hardBreak") {
      out += "  \n";
      i++;
      continue;
    }
    if (n.type !== "text") {
      i++;
      continue;
    }
    const pending = (n.marks ?? [])
      .filter((m) => !active.includes(markKey(m)))
      .sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
    const mark = pending[0];

    if (!mark) {
      out += escapeText(n.text ?? "");
      i++;
      continue;
    }
    if (mark.type === "code") {
      const text = n.text ?? "";
      const fence = text.includes("`") ? "``" : "`";
      out += `${fence}${text}${fence}`;
      i++;
      continue;
    }
    const key = markKey(mark);
    let j = i + 1;
    while (j < nodes.length && nodes[j].type === "text" && (nodes[j].marks ?? []).some((m) => markKey(m) === key)) j++;
    out += wrap(renderInline(nodes.slice(i, j), [...active, key]), mark);
    i = j;
  }
  return out;
}

const indent = (text: string, pad: string) => text.replace(/\n(?!$)/g, `\n${pad}`);

function renderBlock(node: Node): string {
  const children = node.content ?? [];
  switch (node.type) {
    case "paragraph":
      return renderInline(children);
    case "heading":
      return `${"#".repeat(Math.min(6, Number(node.attrs?.level ?? 1)))} ${renderInline(children)}`;
    case "bulletList":
      return children.map((li) => `- ${indent(renderListItem(li), "  ")}`).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return children
        .map((li, i) => {
          const marker = `${start + i}. `;
          return marker + indent(renderListItem(li), " ".repeat(marker.length));
        })
        .join("\n");
    }
    case "blockquote":
      return renderBlocks(children)
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "codeBlock": {
      const text = children.map((c) => c.text ?? "").join("");
      return "```" + (node.attrs?.language ?? "") + "\n" + text + "\n```";
    }
    case "horizontalRule":
      return "---";
    default:
      return children.length ? renderBlocks(children) : "";
  }
}

function renderListItem(li: Node) {
  return (li.content ?? []).map(renderBlock).join("\n");
}

function renderBlocks(nodes: Node[]) {
  return nodes.map(renderBlock).join("\n\n");
}

export function docToMarkdown(doc: unknown, title?: string): string {
  const body = renderBlocks(((doc as Node)?.content ?? []) as Node[]).replace(/\n{3,}/g, "\n\n").trim();
  return (title ? `# ${title}\n\n` : "") + body + "\n";
}

/* ---------------------------------------------------------------- */

export function markdownToHTML(md: string): string {
  return marked.parse(md, { async: false, gfm: true }) as string;
}

/** HTML -> TipTap JSON through the editor schema; anything not in the schema (scripts, styles) is dropped. */
export function htmlToDoc(html: string): JSONContent {
  return generateJSON(html, baseExtensions);
}

export function markdownToDoc(md: string): JSONContent {
  return htmlToDoc(markdownToHTML(md));
}

/** Splits a leading "# Title" line off a Markdown document. */
export function splitTitle(md: string): { title: string | null; body: string } {
  const m = md.replace(/^﻿/, "").match(/^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (!m) return { title: null, body: md };
  return { title: m[1].trim(), body: md.slice(m[0].length) };
}

/* ---------------------------------------------------------------- */

const BLOCK_TYPES = new Set(["paragraph", "heading", "codeBlock", "blockquote", "listItem", "horizontalRule"]);

/** Plain-text projection matching what the editor stores (blocks separated by newlines). */
export function docToPlainText(doc: unknown): string {
  const lines: string[] = [];
  const walk = (n: Node) => {
    if (n.content?.some((c) => c.type === "text" || c.type === "hardBreak")) {
      lines.push(n.content.map((c) => (c.type === "hardBreak" ? "\n" : (c.text ?? ""))).join(""));
      return;
    }
    if (BLOCK_TYPES.has(n.type ?? "") && !n.content?.length) return;
    n.content?.forEach(walk);
  };
  if (doc && typeof doc === "object") walk(doc as Node);
  return lines.join("\n").trim();
}

export function tagsFromDoc(doc: unknown): HighlightTag[] {
  const found = new Set(extractHighlightsFromJSON(doc).map((h) => h.tag));
  return tagOrder().filter((t) => found.has(t)).concat(Array.from(found).filter((t) => !tagOrder().includes(t)));
}

/** Converts a Markdown file into the fields of a new note. */
export function noteFromMarkdown(md: string, fallbackTitle: string) {
  const { title, body } = splitTitle(md);
  const content = markdownToDoc(body);
  return {
    title: (title ?? fallbackTitle).slice(0, 200),
    content,
    plainText: docToPlainText(content),
    tags: tagsFromDoc(content),
  };
}
