import type { Rating } from "./db";

/**
 * Spaced repetition: a simplified SM-2 scheduler (the algorithm behind SuperMemo/Anki).
 *
 * Each card has:
 *   interval  days until the next review (0 = still learning, shown again in 10 minutes)
 *   ease      growth factor for the interval, starts at 2.5, never below 1.3
 *   reps      consecutive successful reviews
 *   lapses    times the card was forgotten ("Again")
 *
 * Ratings:
 *   Again  forgotten: reps reset, ease -0.20, review again in 10 minutes
 *   Hard   recalled with effort: ease -0.15, interval x1.2 (first review: 1 day)
 *   Good   recalled: interval x ease (first review: 1 day, second: 3 days)
 *   Easy   effortless: ease +0.15, interval x ease x 1.3 (first review: 3 days)
 *
 * Intervals are always ordered Again < Hard <= Good < Easy, so harder cards come back sooner
 * (except at the 365-day cap, where Good and Easy can both be one year).
 * The function is pure and deterministic: same input, same output.
 */

export const DAY_MS = 86_400_000;
export const LEARNING_STEP_MS = 10 * 60_000;
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL_DAYS = 365;

export interface SchedulingState {
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface ScheduleResult extends SchedulingState {
  due: number;
}

export const NEW_CARD_STATE: SchedulingState = { interval: 0, ease: DEFAULT_EASE, reps: 0, lapses: 0 };

const clampEase = (e: number) => Math.max(MIN_EASE, Math.round(e * 100) / 100);
const clampDays = (d: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(d)));

function nextIntervals(s: SchedulingState): Record<Exclude<Rating, "again">, number> {
  let hard: number;
  let good: number;
  let easy: number;
  if (s.reps === 0) {
    hard = 1;
    good = 1;
    easy = 3;
  } else if (s.reps === 1) {
    hard = clampDays(Math.max(1, s.interval) * 1.2);
    good = 3;
    easy = clampDays(3 * 1.3 * (s.ease / DEFAULT_EASE) + 1);
  } else {
    const base = Math.max(1, s.interval);
    hard = clampDays(base * 1.2);
    good = clampDays(base * s.ease);
    easy = clampDays(base * (s.ease + 0.15) * 1.3);
  }
  // Enforce ordering so a harder rating never schedules later than an easier one.
  good = Math.min(MAX_INTERVAL_DAYS, Math.max(good, hard));
  easy = Math.min(MAX_INTERVAL_DAYS, Math.max(easy, good + 1));
  return { hard, good, easy };
}

export function schedule(state: SchedulingState, rating: Rating, now: number): ScheduleResult {
  if (rating === "again") {
    return {
      interval: 0,
      ease: clampEase(state.ease - 0.2),
      reps: 0,
      lapses: state.lapses + 1,
      due: now + LEARNING_STEP_MS,
    };
  }
  const interval = nextIntervals(state)[rating];
  const ease =
    rating === "hard" ? clampEase(state.ease - 0.15) : rating === "easy" ? clampEase(state.ease + 0.15) : state.ease;
  return { interval, ease, reps: state.reps + 1, lapses: state.lapses, due: now + interval * DAY_MS };
}

/** Human-readable preview for the rating buttons, e.g. "10m", "1d", "2mo". */
export function previewInterval(state: SchedulingState, rating: Rating): string {
  if (rating === "again") return "10m";
  const d = nextIntervals(state)[rating];
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return "1y";
}

export function endOfDay(now: number) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** A card is due "today" if its due time is before the end of the current local day. */
export const isDue = (card: { due: number }, now: number) => card.due <= endOfDay(now);
