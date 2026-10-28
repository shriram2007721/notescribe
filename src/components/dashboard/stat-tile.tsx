import type { ReactNode } from "react";

/** A single headline number with its definition. Text stays in text tokens; no decorative color. */
export function StatTile({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}
