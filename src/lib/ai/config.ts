"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, getSetting, setSetting } from "../db";
import { docToMarkdown } from "../markdown";
import type { Note } from "../db";

/*
 * AI configuration lives in the local settings table:
 *  - aiProxyUrl: URL of the NoteScribe AI proxy (public; not a secret). Defaults to NEXT_PUBLIC_AI_PROXY_URL.
 *  - aiConsent:  true once the user has agreed that note text is sent to the AI service.
 * No provider API key is ever stored or used in the browser.
 */

export const DEFAULT_AI_URL = process.env.NEXT_PUBLIC_AI_PROXY_URL ?? "";

export function useAIConfig() {
  const config = useLiveQuery(async () => {
    const [url, consent] = await Promise.all([getSetting("aiProxyUrl", DEFAULT_AI_URL), getSetting("aiConsent", false)]);
    return { url: url.trim(), consent };
  }, []);
  return config;
}

export const setAIUrl = (url: string) => setSetting("aiProxyUrl", url.trim());
export const setAIConsent = (v: boolean) => setSetting("aiConsent", v);
export const getAIConfig = async () => ({
  url: (await getSetting("aiProxyUrl", DEFAULT_AI_URL)).trim(),
  consent: await getSetting("aiConsent", false),
});

export function isValidProxyUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Note text sent to the AI: Markdown structure kept, highlight tags reduced to plain text. */
export function noteToSourceText(note: Pick<Note, "content">) {
  return docToMarkdown(note.content)
    .replace(/<mark data-tag="\w+">/g, "")
    .replace(/<\/mark>/g, "")
    .trim();
}

export async function noteSources(ids: string[]) {
  const notes = (await db.notes.bulkGet(ids)).filter((n): n is Note => Boolean(n));
  return notes.map((n) => ({ id: n.id, title: n.title || "Untitled note", text: noteToSourceText(n) })).filter((s) => s.text);
}
