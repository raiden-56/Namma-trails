import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  action,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex max-w-3xl flex-col gap-3">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Tag className="font-display text-display-lg">{title}</Tag>
        {intro ? <div className="max-w-2xl text-lead text-fg-muted">{intro}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
