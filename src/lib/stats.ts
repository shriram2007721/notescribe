import type { Flashcard, Note, QuizAttempt, Review } from "./db";
import { isDue } from "./srs";

/**
 * Study metrics, all computed from stored records. Definitions:
 *  - notesCreatedThisWeek: notes whose createdAt falls in the last 7 days (rolling)
 *  - dueToday:             flashcards with a due time before the end of today
 *  - reviewsThisWeek:      flashcard ratings recorded in the last 7 days
 *  - quizAccuracy:         correct / answered across all saved quiz attempts (null if none)
 *  - activity:             per day for the last 7 days, flashcard reviews + quiz questions answered
 * Time spent in the app is deliberately not measured.
 */

const DAY = 86_400_000;

export function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DayActivity {
  day: number;
  reviews: number;
  quizAnswers: number;
}

export interface StudyStats {
  totalNotes: number;
  notesCreatedThisWeek: number;
  totalCards: number;
  dueToday: number;
  reviewsThisWeek: number;
  quizAccuracy: number | null;
  quizzesTaken: number;
  activity: DayActivity[];
}

export function computeStats(
  notes: Note[],
  cards: Flashcard[],
  reviews: Review[],
  quizzes: QuizAttempt[],
  now = Date.now(),
): StudyStats {
  const active = notes.filter((n) => n.deletedAt === undefined);
  const weekAgo = now - 7 * DAY;
  const today = startOfDay(now);

  const activity: DayActivity[] = Array.from({ length: 7 }, (_, i) => ({
    day: startOfDay(today - (6 - i) * DAY + DAY / 2), // midday offset keeps DST shifts on the right day
    reviews: 0,
    quizAnswers: 0,
  }));
  const bucket = (t: number) => activity.find((a) => a.day === startOfDay(t));

  for (const r of reviews) {
    const b = bucket(r.reviewedAt);
    if (b) b.reviews++;
  }
  let answered = 0;
  let correct = 0;
  for (const q of quizzes) {
    answered += q.total;
    correct += q.correct;
    const b = bucket(q.finishedAt);
    if (b) b.quizAnswers += q.total;
  }

  return {
    totalNotes: active.length,
    notesCreatedThisWeek: active.filter((n) => n.createdAt >= weekAgo).length,
    totalCards: cards.length,
    dueToday: cards.filter((c) => isDue(c, now)).length,
    reviewsThisWeek: reviews.filter((r) => r.reviewedAt >= weekAgo).length,
    quizAccuracy: answered ? correct / answered : null,
    quizzesTaken: quizzes.length,
    activity,
  };
}
