"use client";

import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

function ChoiceBase({ type, label, description, className, ref, ...props }: ChoiceProps & { type: "checkbox" | "radio" }) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-3 py-1 has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
      <input
        ref={ref}
        type={type}
        className={cn(
          "mt-0.5 size-5 shrink-0 cursor-pointer border-line-strong accent-(--color-burnt)",
          type === "radio" ? "rounded-full" : "rounded-xs",
        )}
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-[0.9375rem] font-medium text-fg">{label}</span>
        {description ? <span className="text-sm text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <ChoiceBase type="checkbox" {...props} />;
}

export function Radio(props: ChoiceProps) {
  return <ChoiceBase type="radio" {...props} />;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50",
          checked ? "border-burnt bg-burnt" : "border-line-strong bg-surface-sunken",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-5 rounded-full bg-ivory shadow transition-transform duration-200 ease-(--ease-editorial)",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
      <span className="text-sm font-medium text-fg" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}
