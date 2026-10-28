"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Modal } from "./modal";

/* ------------------------------ Toasts ------------------------------ */

type Tone = "default" | "success" | "error";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Tone };

/* ------------------------------ Confirm ----------------------------- */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface FeedbackApi {
  toast: (t: ToastInput) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts.slice(-3), { tone: "default", ...t, id }]);
      setTimeout(() => dismiss(id), t.action ? 8000 : 4500);
    },
    [dismiss],
  );

  const confirm = useCallback((o: ConfirmOptions) => {
    setPending(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <Modal
        open={!!pending}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        description={pending?.description}
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button variant={pending?.destructive ? "destructive" : "default"} onClick={() => settle(true)} autoFocus>
              {pending?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />

      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2",
                t.tone === "error" && "border-destructive/50",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.tone === "success" && "text-green-600 dark:text-green-400", t.tone === "error" && "text-destructive")} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-muted-foreground">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  className="shrink-0 rounded px-2 py-1 text-sm font-medium text-primary hover:bg-accent"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="shrink-0 rounded p-0.5 hover:bg-accent">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}
