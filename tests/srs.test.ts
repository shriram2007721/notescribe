import { describe, expect, it } from "vitest";
import type { Rating } from "@/lib/db";
import { DAY_MS, LEARNING_STEP_MS, MIN_EASE, NEW_CARD_STATE, isDue, previewInterval, schedule } from "@/lib/srs";

const NOW = Date.UTC(2026, 0, 10, 12);
const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

describe("schedule (SM-2 variant)", () => {
  it("first review intervals for a new card", () => {
    expect(schedule(NEW_CARD_STATE, "again", NOW)).toMatchObject({ interval: 0, reps: 0, lapses: 1, due: NOW + LEARNING_STEP_MS });
    expect(schedule(NEW_CARD_STATE, "hard", NOW)).toMatchObject({ interval: 1, reps: 1, due: NOW + DAY_MS });
    expect(schedule(NEW_CARD_STATE, "good", NOW)).toMatchObject({ interval: 1, reps: 1, ease: 2.5 });
    expect(schedule(NEW_CARD_STATE, "easy", NOW)).toMatchObject({ interval: 3, reps: 1, ease: 2.65 });
  });

  it("second Good review gives 3 days, then grows by ease", () => {
    const s1 = schedule(NEW_CARD_STATE, "good", NOW);
    const s2 = schedule(s1, "good", NOW);
    expect(s2.interval).toBe(3);
    const s3 = schedule(s2, "good", NOW);
    expect(s3.interval).toBe(Math.round(3 * 2.5));
  });

  it("harder ratings never come back later than easier ones", () => {
    const states = [
      NEW_CARD_STATE,
      { interval: 1, ease: 2.5, reps: 1, lapses: 0 },
      { interval: 10, ease: 1.3, reps: 5, lapses: 3 },
      { interval: 40, ease: 3.1, reps: 9, lapses: 0 },
    ];
    for (const s of states) {
      const due = RATINGS.map((r) => schedule(s, r, NOW).due);
      expect(due[0]).toBeLessThan(due[1]);
      expect(due[1]).toBeLessThanOrEqual(due[2]);
      expect(due[2]).toBeLessThan(due[3]);
    }
  });

  it("Again resets reps, counts a lapse and lowers ease but not below the minimum", () => {
    const s = schedule({ interval: 30, ease: 1.35, reps: 6, lapses: 0 }, "again", NOW);
    expect(s).toMatchObject({ reps: 0, lapses: 1, ease: MIN_EASE, interval: 0 });
  });

  it("caps intervals at one year", () => {
    const s = { interval: 300, ease: 3, reps: 10, lapses: 0 };
    expect(schedule(s, "easy", NOW).interval).toBe(365);
    expect(schedule(s, "good", NOW).interval).toBe(365);
  });

  it("is deterministic", () => {
    const s = { interval: 7, ease: 2.2, reps: 3, lapses: 1 };
    expect(schedule(s, "good", NOW)).toEqual(schedule(s, "good", NOW));
  });

  it("previews intervals for the rating buttons", () => {
    expect(previewInterval(NEW_CARD_STATE, "again")).toBe("10m");
    expect(previewInterval(NEW_CARD_STATE, "easy")).toBe("3d");
    expect(previewInterval({ interval: 60, ease: 2.5, reps: 5, lapses: 0 }, "good")).toBe("5mo");
  });

  it("isDue counts anything due before the end of today", () => {
    const later = new Date(NOW);
    later.setHours(23, 0, 0, 0);
    expect(isDue({ due: later.getTime() }, NOW)).toBe(true);
    expect(isDue({ due: later.getTime() + DAY_MS }, NOW)).toBe(false);
  });
});
