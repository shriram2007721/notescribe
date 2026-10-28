import { z } from "zod";
import type { Flashcard } from "./db";

/* ---------------------------------------------------------------- */
/* Question model shared by local (flashcard) and AI-generated quizzes */
/* ---------------------------------------------------------------- */

export const mcqSchema = z.object({
  kind: z.literal("mcq"),
  prompt: z.string().min(1).max(1000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6),
  answerIndex: z.number().int().min(0),
  explanation: z.string().max(2000).default(""),
});

export const trueFalseSchema = z.object({
  kind: z.literal("truefalse"),
  prompt: z.string().min(1).max(1000),
  answer: z.boolean(),
  explanation: z.string().max(2000).default(""),
});

export const shortSchema = z.object({
  kind: z.literal("short"),
  prompt: z.string().min(1).max(1000),
  expected: z.string().min(1).max(2000),
  explanation: z.string().max(2000).default(""),
});

export const questionSchema = z
  .discriminatedUnion("kind", [mcqSchema, trueFalseSchema, shortSchema])
  .refine((q) => q.kind !== "mcq" || q.answerIndex < q.options.length, { message: "answerIndex out of range" });

export const quizSchema = z.object({ questions: z.array(questionSchema).min(1).max(30) });

export type QuestionData = z.infer<typeof questionSchema>;
export type Question = QuestionData & { id: string; cardId?: string };

/* ---------------------------------------------------------------- */
/* Local quiz generation from flashcards (no AI, works offline)      */
/* ---------------------------------------------------------------- */

/** Small deterministic PRNG (mulberry32) so quizzes are reproducible in tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface BuildQuizOptions {
  count?: number;
  seed?: number;
}

/**
 * Builds a quiz from flashcards:
 *  - multiple choice when there are at least 4 distinct answers (distractors = other cards' answers)
 *  - true/false pairing a question with its own or another card's answer
 *  - short answer (self-checked) otherwise
 */
export function buildQuizFromCards(cards: Flashcard[], { count = 10, seed = Date.now() }: BuildQuizOptions = {}): Question[] {
  const rand = rng(seed);
  const picked = shuffle(cards, rand).slice(0, count);
  const answers = Array.from(new Set(cards.map((c) => c.back)));

  return picked.map((card, i): Question => {
    const others = answers.filter((a) => a !== card.back);
    const roll = rand();
    const base = { id: `q${i}`, cardId: card.id, prompt: card.front };

    if (others.length >= 3 && roll < 0.6) {
      const options = shuffle([card.back, ...shuffle(others, rand).slice(0, 3)], rand);
      return { ...base, kind: "mcq", options, answerIndex: options.indexOf(card.back), explanation: `Answer: ${card.back}` };
    }
    if (others.length >= 1 && roll < 0.8) {
      const truthful = rand() < 0.5;
      const shown = truthful ? card.back : others[Math.floor(rand() * others.length)];
      return {
        ...base,
        kind: "truefalse",
        prompt: `${card.front}\n\nProposed answer: ${shown}`,
        answer: truthful,
        explanation: `Correct answer: ${card.back}`,
      };
    }
    return { ...base, kind: "short", expected: card.back, explanation: "" };
  });
}

export function withIds(questions: QuestionData[]): Question[] {
  return questions.map((q, i) => ({ ...q, id: `q${i}` }));
}

// Built at runtime: a regex literal with the "u" flag isn't allowed by this project's TypeScript target.
// \p{M} keeps combining marks (vowel signs in Devanagari, Tamil, etc.), which are part of the word.
const NOT_LETTER_OR_DIGIT = new RegExp("[^\\p{L}\\p{M}\\p{N}\\s]", "gu");

/** Lenient comparison for short answers: case, punctuation and extra spaces are ignored (any language). */
export function normalizeAnswer(s: string) {
  return s
    .toLowerCase()
    .replace(NOT_LETTER_OR_DIGIT, "")
    .replace(/\s+/g, " ")
    .trim();
}
