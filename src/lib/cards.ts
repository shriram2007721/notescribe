import { nanoid } from "nanoid";
import { db, type Flashcard, type Note, type Rating, type Review } from "./db";
import { extractHighlightsFromJSON } from "./highlights";
import { isDue, NEW_CARD_STATE, schedule } from "./srs";

export const MAX_CARD_TEXT = 2000;

export interface CardDraft {
  front: string;
  back: string;
}

function clean(draft: CardDraft): CardDraft {
  const front = draft.front.trim().slice(0, MAX_CARD_TEXT);
  const back = draft.back.trim().slice(0, MAX_CARD_TEXT);
  if (!front || !back) throw new Error("Both the question and the answer are required.");
  return { front, back };
}

export function newCard(draft: CardDraft, extra: Partial<Flashcard> = {}, now = Date.now()): Flashcard {
  return {
    id: nanoid(),
    ...clean(draft),
    source: "manual",
    createdAt: now,
    updatedAt: now,
    due: now,
    ...NEW_CARD_STATE,
    ...extra,
  };
}

export async function addCards(drafts: CardDraft[], extra: Partial<Flashcard> = {}) {
  const now = Date.now();
  const cards = drafts.map((d) => newCard(d, extra, now));
  await db.cards.bulkAdd(cards);
  return cards;
}

export function updateCard(id: string, draft: CardDraft) {
  return db.cards.update(id, { ...clean(draft), updatedAt: Date.now() });
}

export async function deleteCard(id: string) {
  await db.transaction("rw", db.cards, db.reviews, async () => {
    await db.reviews.where("cardId").equals(id).delete();
    await db.cards.delete(id);
  });
}

/** Applies a rating: updates scheduling state and logs the review, atomically. */
export async function reviewCard(card: Flashcard, rating: Rating, now = Date.now()) {
  const next = schedule(card, rating, now);
  const review: Review = {
    id: nanoid(),
    cardId: card.id,
    rating,
    reviewedAt: now,
    intervalBefore: card.interval,
    intervalAfter: next.interval,
  };
  await db.transaction("rw", db.cards, db.reviews, async () => {
    await db.cards.update(card.id, { ...next, lastReviewedAt: now });
    await db.reviews.add(review);
  });
  return { ...card, ...next, lastReviewedAt: now };
}

export const dueCards = (cards: Flashcard[], now = Date.now()) =>
  cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due);

/**
 * Turns a note's smart highlights into card drafts.
 * When a highlight sits inside a longer sentence, the front is that sentence with the highlight blanked out
 * (cloze card). When the highlight is the whole sentence, the front asks to recall that category of point.
 * Drafts are always shown to the user for editing before saving.
 */
export function draftsFromHighlights(note: Pick<Note, "title" | "content">): CardDraft[] {
  const highlights = extractHighlightsFromJSON(note.content);
  const seen = new Set<string>();
  const out: CardDraft[] = [];
  for (const h of highlights) {
    const key = h.text.toLowerCase();
    if (seen.has(key) || h.text.length < 3) continue;
    seen.add(key);
    const label = h.tag === "exam" ? "exam point" : h.tag === "interview" ? "interview point" : "key concept";
    const context = h.sentence && h.sentence !== h.text ? h.sentence.replace(h.text, "_____") : null;
    out.push({
      front: context ? `${note.title || "Note"}: fill in the blank\n${context}` : `${note.title || "Note"}: recall this ${label}`,
      back: h.text,
    });
  }
  return out;
}
