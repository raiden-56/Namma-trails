import type { InputHTMLAttributes, TextareaHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

/* Dropdowns and date fields are not here: see Select.tsx and DatePicker.tsx. */

export const controlClasses =
  "w-full rounded-md border border-line-strong bg-surface-raised px-3.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] duration-150 hover:border-fg/60 " +
  "focus:border-accent-text focus:outline-none focus:ring-3 focus:ring-accent-text/25 " +
  "aria-invalid:border-danger aria-invalid:ring-danger/20 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(controlClasses, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  rows = 4,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} rows={rows} className={cn(controlClasses, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

