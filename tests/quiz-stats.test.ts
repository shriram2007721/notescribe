import { describe, expect, it } from "vitest";
import type { Flashcard, Note, QuizAttempt, Review } from "@/lib/db";
import { buildQuizFromCards, normalizeAnswer, quizSchema } from "@/lib/quiz";
import { computeStats } from "@/lib/stats";

const card = (i: number): Flashcard => ({
  id: `c${i}`,
  front: `Question ${i}`,
  back: `Answer ${i}`,
  source: "manual",
  createdAt: 0,
  updatedAt: 0,
  due: 0,
  interval: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
});

describe("local quiz from flashcards", () => {
  const cards = Array.from({ length: 8 }, (_, i) => card(i));

  it("is deterministic for a given seed and produces valid questions", () => {
    const a = buildQuizFromCards(cards, { count: 6, seed: 42 });
    expect(a).toEqual(buildQuizFromCards(cards, { count: 6, seed: 42 }));
    expect(a).toHaveLength(6);
    for (const q of a) {
      const c = cards.find((x) => x.id === q.cardId)!;
      if (q.kind === "mcq") {
        expect(q.options[q.answerIndex]).toBe(c.back);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
      if (q.kind === "short") expect(q.expected).toBe(c.back);
    }
  });

  it("falls back to short answers when there are no distractors", () => {
    expect(buildQuizFromCards([card(1)], { seed: 1 })[0].kind).toBe("short");
  });

  it("normalizes short answers", () => {
    expect(normalizeAnswer("  The  Mitochondria! ")).toBe("the mitochondria");
    expect(normalizeAnswer("pH = 7.0 (neutral)")).toBe("ph 70 neutral");
    expect(normalizeAnswer("Ångström, für")).toBe("ångström für");
    expect(normalizeAnswer("प्रकाश संश्लेषण।")).toBe("प्रकाश संश्लेषण");
  });
});

describe("AI quiz validation", () => {
  it("accepts well-formed questions and rejects broken ones", () => {
    expect(quizSchema.safeParse({ questions: [{ kind: "truefalse", prompt: "Sky is blue", answer: true }] }).success).toBe(true);
    expect(quizSchema.safeParse({ questions: [{ kind: "mcq", prompt: "x", options: ["a", "b"], answerIndex: 5 }] }).success).toBe(false);
    expect(quizSchema.safeParse({ questions: [] }).success).toBe(false);
    expect(quizSchema.safeParse({ questions: [{ kind: "essay", prompt: "x" }] }).success).toBe(false);
  });
});

describe("computeStats", () => {
  it("derives metrics only from stored records", () => {
    const now = new Date(2026, 0, 10, 15).getTime();
    const day = 86_400_000;
    const note = (over: Partial<Note>): Note => ({
      id: "n",
      title: "",
      content: {},
      plainText: "",
      tags: [],
      createdAt: 0,
      updatedAt: 0,
      syncStatus: "local",
      pinned: 0,
      favorite: 0,
      ...over,
    });
    const notes = [note({ createdAt: now - day }), note({ createdAt: now - 30 * day }), note({ createdAt: now, deletedAt: now })];
    const cards = [{ ...card(1), due: now - day }, { ...card(2), due: now + 3 * day }];
    const reviews: Review[] = [
      { id: "r1", cardId: "c1", rating: "good", reviewedAt: now - 2 * 60_000, intervalBefore: 0, intervalAfter: 1 },
      { id: "r2", cardId: "c1", rating: "again", reviewedAt: now - 2 * day, intervalBefore: 1, intervalAfter: 0 },
      { id: "r3", cardId: "c1", rating: "good", reviewedAt: now - 20 * day, intervalBefore: 0, intervalAfter: 1 },
    ];
    const quizzes: QuizAttempt[] = [
      { id: "q", title: "", source: "flashcards", noteIds: [], total: 4, correct: 3, answers: [], startedAt: now, finishedAt: now },
    ];

    const s = computeStats(notes, cards, reviews, quizzes, now);
    expect(s).toMatchObject({ totalNotes: 2, notesCreatedThisWeek: 1, totalCards: 2, dueToday: 1, reviewsThisWeek: 2, quizAccuracy: 0.75, quizzesTaken: 1 });
    expect(s.activity).toHaveLength(7);
    expect(s.activity[6]).toMatchObject({ reviews: 1, quizAnswers: 4 });
    expect(s.activity[4].reviews).toBe(1);
  });

  it("reports no quiz accuracy when no quizzes were taken", () => {
    expect(computeStats([], [], [], []).quizAccuracy).toBeNull();
  });
});
