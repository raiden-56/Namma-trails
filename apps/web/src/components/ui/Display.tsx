import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const dims = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base" }[size];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from signed storage URLs
    <img src={src} alt={name} className={cn("rounded-full object-cover", dims)} />
  ) : (
    <span role="img" aria-label={name} className={cn("inline-flex items-center justify-center rounded-full bg-sand font-semibold text-ink", dims)}>
      {initials}
    </span>
  );
}

/** KPI tile. `value` null renders an honest "no data yet" state instead of a fake number. */
export function KpiTile({
  label,
  value,
  hint,
  trend,
  density = "comfortable",
}: {
  label: string;
  value: ReactNode | null;
  hint?: string;
  trend?: ReactNode;
  density?: "comfortable" | "compact";
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border border-line bg-surface-raised", density === "compact" ? "p-3.5" : "p-5")}>
      <span className="text-xs font-semibold text-fg-muted">{label}</span>
      <span className={cn("font-semibold tabular-nums text-fg", density === "compact" ? "text-xl" : "text-3xl")}>
        {value ?? <span aria-label="No data yet">—</span>}
      </span>
      <span className="text-xs text-fg-muted">{value === null ? "No data yet" : hint}</span>
      {trend}
    </div>
  );
}

export interface Step {
  id: string;
  label: string;
}

/** Progress stepper for multi-step flows (provider onboarding, checkout). */
export function Stepper({ steps, current, className }: { steps: Step[]; current: number; className?: string }) {
  return (
    <nav aria-label="Progress" className={className}>
      <p className="mb-3 text-sm text-fg-muted md:sr-only">
        Step {current + 1} of {steps.length}: <span className="font-semibold text-fg">{steps[current]?.label}</span>
      </p>
      <ol className="flex items-center gap-2" role="list">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "done" && "border-fg bg-fg text-surface",
                  state === "current" && "border-accent-text bg-accent text-accent-fg",
                  state === "upcoming" && "border-line-strong text-fg-muted",
                )}
              >
                {state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                <span className="sr-only">
                  {step.label} ({state === "done" ? "completed" : state === "current" ? "current step" : "not started"})
                </span>
              </span>
              <span className={cn("hidden truncate text-sm md:inline", state === "current" ? "font-semibold text-fg" : "text-fg-muted")}>
                {step.label}
              </span>
              {i < steps.length - 1 ? <span aria-hidden="true" className={cn("h-px flex-1", i < current ? "bg-fg" : "bg-line-strong")} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
