import StarterKit from "@tiptap/starter-kit";
import { SmartHighlight } from "./smart-highlight";

/**
 * The document schema shared by the editor, Markdown/HTML import and export.
 * SmartHighlight comes first so it renders outside bold/italic (one element, one icon).
 */
export const baseExtensions = [SmartHighlight, StarterKit];
