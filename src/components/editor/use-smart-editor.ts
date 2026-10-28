"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef } from "react";
import { SmartHighlight } from "./smart-highlight";

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
    extensions: [
      SmartHighlight,
      StarterKit,
      Placeholder.configure({ placeholder: "Start typing, or tap the mic to dictate…" }),
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "tiptap-content focus:outline-none min-h-[50vh] py-4" },
    },
    onUpdate: ({ editor }) => onUpdateRef.current?.(editor),
  });
}
