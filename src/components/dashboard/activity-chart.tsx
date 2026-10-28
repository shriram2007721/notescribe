"use client";

import { useState } from "react";
import type { DayActivity } from "@/lib/stats";
import { cn } from "@/lib/utils";

const dayLabel = (t: number, style: "short" | "long") =>
  new Date(t).toLocaleDateString(undefined, style === "short" ? { weekday: "short" } : { weekday: "long", day: "numeric", month: "short" });

/**
 * Single-series bar chart: study actions per day (flashcard reviews + quiz questions answered).
 * One hue, no legend (the heading names the series), hover/focus tooltip per bar, and a table for screen readers.
 */
export function ActivityChart({ days }: { days: DayActivity[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = days.map((d) => d.reviews + d.quizAnswers);
  const max = Math.max(1, ...totals);
  const sum = totals.reduce((a, b) => a + b, 0);

  return (
    <figure className="rounded-lg border bg-card p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Study activity, last 7 days</span>
        <span className="text-xs text-muted-foreground">{sum} actions</span>
      </figcaption>

      <div className="relative flex h-28 items-end gap-0.5 border-b" aria-hidden="true">
        {days.map((d, i) => {
          const total = totals[i];
          return (
            <div
              key={d.day}
              tabIndex={-1}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="relative flex h-full flex-1 items-end justify-center"
            >
              <div
                className={cn("w-full max-w-8 rounded-t bg-primary transition-opacity", hover !== null && hover !== i && "opacity-40")}
                style={{ height: total ? `${Math.max(4, (total / max) * 100)}%` : 0 }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow">
                  <p className="font-medium">{dayLabel(d.day, "long")}</p>
                  <p className="text-muted-foreground">
                    {d.reviews} card reviews · {d.quizAnswers} quiz answers
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5" aria-hidden="true">
        {days.map((d) => (
          <span key={d.day} className="flex-1 text-center text-[11px] text-muted-foreground">
            {dayLabel(d.day, "short")}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Study activity per day: flashcard reviews and quiz questions answered</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Card reviews</th>
            <th>Quiz answers</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{dayLabel(d.day, "long")}</td>
              <td>{d.reviews}</td>
              <td>{d.quizAnswers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sum === 0 && <p className="mt-2 text-xs text-muted-foreground">No reviews or quizzes yet this week.</p>}
    </figure>
  );
}
