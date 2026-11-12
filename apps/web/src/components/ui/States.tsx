import type { ReactNode } from "react";
import { AlertTriangle, Sprout } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = "default",
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "editorial";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-dashed border-line-strong p-6 sm:p-8",
        tone === "editorial" && "bg-surface-raised/60",
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-sage/35 text-fg">
        {icon ?? <Sprout className="size-5" />}
      </span>
      <div className="flex max-w-prose flex-col gap-1.5">
        <h3 className="font-display text-xl text-fg">{title}</h3>
        {description ? <div className="text-[0.9375rem] leading-relaxed text-fg-muted">{description}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-4 rounded-lg border border-danger/40 bg-danger/5 p-6", className)}>
      <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-danger/15 text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold text-fg">{title}</h3>
        {description ? <div className="text-[0.9375rem] text-fg-muted">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}
