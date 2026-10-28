"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Route-level error boundary: a crash in one page never takes the whole app (or unsaved state elsewhere) down. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <h1 className="text-lg font-semibold">Something went wrong on this page</h1>
      <p className="text-sm text-muted-foreground">
        Your notes are stored on this device and weren&apos;t affected. Try again, or go back to your notes.
      </p>
      <p className="max-w-full truncate rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{error.message}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          My notes
        </Link>
      </div>
    </div>
  );
}
