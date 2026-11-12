"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastApi {
  toast: (input: { title: string; description?: string; tone?: Tone; durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<Tone, { icon: ReactNode; className: string }> = {
  info: { icon: <Info className="size-5 text-info" />, className: "border-info/30" },
  success: { icon: <CheckCircle2 className="size-5 text-success" />, className: "border-success/30" },
  warning: { icon: <TriangleAlert className="size-5 text-warning" />, className: "border-warning/40" },
  danger: { icon: <XCircle className="size-5 text-danger" />, className: "border-danger/40" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastApi["toast"]>(
    ({ title, description, tone = "info", durationMs = 6000 }) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "danger" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-lg border bg-surface-raised p-4 text-fg shadow-lift",
              toneStyles[t.tone].className,
            )}
          >
            <span aria-hidden="true">{toneStyles[t.tone].icon}</span>
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description ? <p className="text-sm text-fg-muted">{t.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-full p-1 text-fg-muted hover:bg-fg/8 hover:text-fg"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
