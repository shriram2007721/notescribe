import { Mark, mergeAttributes } from "@tiptap/core";
import type { HighlightTag } from "@/lib/db";
import { HIGHLIGHTS, HIGHLIGHT_ORDER } from "@/lib/highlights";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    smartHighlight: {
      setSmartHighlight: (tag: HighlightTag) => ReturnType;
      toggleSmartHighlight: (tag: HighlightTag) => ReturnType;
      unsetSmartHighlight: () => ReturnType;
    };
  }
}

/**
 * One mark type with a `tag` attribute (exam | interview | concept).
 * A single mark type means applying a new tag replaces the old one instead of stacking.
 * The icon is drawn with CSS ::before (see globals.css) so it never pollutes the text.
 */
export const SmartHighlight = Mark.create({
  name: "smartHighlight",
  // Render outside bold/italic so a highlight spanning mixed formatting is one element (one icon).
  priority: 1000,
  inclusive: false,

  addAttributes() {
    return {
      tag: {
        default: "exam",
        parseHTML: (el) => el.getAttribute("data-tag"),
        renderHTML: (attrs) => ({ "data-tag": attrs.tag }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-tag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes({ class: "smart-hl" }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setSmartHighlight:
        (tag) =>
        ({ commands }) =>
          commands.setMark(this.name, { tag }),
      toggleSmartHighlight:
        (tag) =>
        ({ editor, commands }) =>
          editor.isActive(this.name, { tag }) ? commands.unsetMark(this.name) : commands.setMark(this.name, { tag }),
      unsetSmartHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return Object.fromEntries(
      HIGHLIGHT_ORDER.map((tag) => [HIGHLIGHTS[tag].shortcut, () => this.editor.commands.toggleSmartHighlight(tag)]),
    );
  },
});
