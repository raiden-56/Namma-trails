import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "outline" | "solid";
  size?: "sm" | "md" | "lg";
}

const variants = {
  ghost: "text-fg hover:bg-fg/8",
  outline: "border border-line-strong text-fg hover:border-fg",
  solid: "bg-fg text-surface hover:bg-burnt hover:text-ivory",
};
const sizes = { sm: "size-9", md: "size-11", lg: "size-14" };

export function IconButton({ label, icon, variant = "ghost", size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </button>
  );
}
