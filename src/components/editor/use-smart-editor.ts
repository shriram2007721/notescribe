"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { useRef } from "react";
import { baseExtensions } from "./extensions";

export function useSmartEditor({
  content,
  editable = true,
  onUpdate,
}: {
  content: JSONContent;
  editable?: boolean;
  onUpdate?: (editor: Editor) => void;
}) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  return useEditor({
    extensions: [...baseExtensions, Placeholder.configure({ placeholder: "Start typing, or open the recorder to dictate…" })],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none min-h-[55vh] py-4",
        "aria-label": "Note content",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onUpdateRef.current?.(editor),
  });
}
