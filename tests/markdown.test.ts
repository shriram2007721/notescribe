import { describe, expect, it } from "vitest";
import { docToMarkdown, docToPlainText, markdownToDoc, noteFromMarkdown, tagsFromDoc } from "@/lib/markdown";

type M = { type: string; attrs?: Record<string, unknown> };
const text = (t: string, marks?: M[]) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const hl = (tag: string): M => ({ type: "smartHighlight", attrs: { tag } });
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const li = (...content: unknown[]) => ({ type: "listItem", content: [para(...content)] });

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Deadlocks")] },
    para(
      text("Four "),
      text("Coffman", [hl("exam"), { type: "bold" }]),
      text(" conditions", [hl("exam")]),
      text(" and "),
      text("italic", [{ type: "italic" }]),
      text(" with "),
      text("code()", [{ type: "code" }]),
      text(" and a literal *star*."),
    ),
    { type: "bulletList", content: [li(text("one")), li(text("two", [hl("interview")]))] },
    { type: "orderedList", attrs: { start: 1 }, content: [li(text("first"))] },
    { type: "blockquote", content: [para(text("quoted", [hl("concept")]))] },
  ],
};

describe("docToMarkdown", () => {
  const md = docToMarkdown(doc, "OS notes");

  it("writes headings, lists, emphasis and highlights", () => {
    expect(md).toContain("# OS notes");
    expect(md).toContain("## Deadlocks");
    expect(md).toContain('<mark data-tag="exam">**Coffman** conditions</mark>');
    expect(md).toContain("*italic*");
    expect(md).toContain("`code()`");
    expect(md).toContain("\\*star\\*");
    expect(md).toContain('- <mark data-tag="interview">two</mark>');
    expect(md).toContain("1. first");
    expect(md).toContain('> <mark data-tag="concept">quoted</mark>');
  });

  it("round-trips through import with highlights, formatting and structure intact", () => {
    const back = noteFromMarkdown(md, "fallback");
    expect(back.title).toBe("OS notes");
    expect(back.tags).toEqual(["exam", "interview", "concept"]);
    expect(docToMarkdown(back.content)).toBe(docToMarkdown(doc));
    expect(back.plainText).toContain("Four Coffman conditions and italic with code() and a literal *star*.");
  });
});

describe("markdown import safety and fallbacks", () => {
  it("drops script tags and unknown attributes", () => {
    const d = markdownToDoc('Hello <script>alert(1)</script><mark data-tag="exam" onclick="x()">hi</mark>');
    const json = JSON.stringify(d);
    expect(json).not.toContain("script");
    expect(json).not.toContain("onclick");
    expect(tagsFromDoc(d)).toEqual(["exam"]);
  });

  it("uses the fallback title when there is no leading heading", () => {
    expect(noteFromMarkdown("just text", "file-name").title).toBe("file-name");
  });

  it("produces plain text for search", () => {
    expect(docToPlainText(markdownToDoc("# A\n\n- b\n- c"))).toBe("A\nb\nc");
  });
});
