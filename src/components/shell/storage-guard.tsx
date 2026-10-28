"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { recoverOnce } from "@/lib/save-journal";

/** Shows a clear message when IndexedDB can't be opened, instead of an empty, silently broken app. */
export function StorageGuard() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.open()
      .then(() => recoverOnce())
      .catch((err: unknown) => {
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "QuotaExceededError"
          ? "Your device is out of storage space, so new changes can't be saved. Free up space, then reload."
          : "This browser blocked local storage (private mode or disabled site data), so notes can't be saved here. Use a normal window or allow site data, then reload.",
      );
    });
  }, []);

  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p>{error}</p>
    </div>
  );
}
