import { Mark, mergeAttributes } from "@tiptap/core";
import type { HighlightTag } from "@/lib/db";
import { tagFill, tagInfo, tagOrder } from "@/lib/highlights";

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
 * One mark type with a `tag` attribute (any tag id from the registry).
 * A single mark type means applying a new tag replaces the old one instead of stacking.
 * The icon and colour are written onto the element, so user-created tags look the same as defaults.
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
    const tag = String(HTMLAttributes["data-tag"] ?? "");
    return [
      "mark",
      mergeAttributes({ class: "smart-hl", "data-icon": tagInfo(tag).icon, style: `background: ${tagFill(tag, 0.5)}` }, HTMLAttributes),
      0,
    ];
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
    // Mod-Alt-1 … Mod-Alt-9 apply the first nine tags.
    return Object.fromEntries(
      tagOrder()
        .slice(0, 9)
        .map((tag, i) => [`Mod-Alt-${i + 1}`, () => this.editor.commands.toggleSmartHighlight(tag)]),
    );
  },
});
