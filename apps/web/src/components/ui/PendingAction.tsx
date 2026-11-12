import { useId, type ReactNode } from "react";
import { PENDING_HINT } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

/**
 * An action that exists in the product design but is not wired yet.
 * Rendered visibly disabled with an explanatory hint — never a dead button.
 */
export function PendingAction({
  children,
  hint = PENDING_HINT,
  variant = "secondary",
  size = "md",
  className,
  showHint = true,
}: {
  children: ReactNode;
  hint?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showHint?: boolean;
}) {
  const id = useId();
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button type="button" disabled aria-describedby={id} title={hint} className={buttonClasses(variant, size)}>
        {children}
      </button>
      <span id={id} className={cn("text-xs text-fg-muted", !showHint && "sr-only")}>
        {hint}
      </span>
    </span>
  );
}
