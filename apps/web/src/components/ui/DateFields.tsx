"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { todayInIndia } from "@/lib/format";
import { DatePicker } from "./DatePicker";

/* A labelled date field. The calendar itself is DatePicker (our own, not the browser's date input). */

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  required,
  rangeStart,
  rangeEnd,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  /** Shades the days between these two dates in the calendar, for a from/to pair. */
  rangeStart?: string;
  rangeEnd?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <DatePicker
        id={id}
        value={value}
        onValueChange={onChange}
        min={min ?? todayInIndia()}
        max={max}
        clearable={!required}
        aria-required={required || undefined}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
    </div>
  );
}

export function DateRangeField({
  startLabel = "From",
  endLabel = "To",
  value,
  onChange,
  className,
}: {
  startLabel?: string;
  endLabel?: string;
  value: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("grid grid-cols-2 gap-3", className)}>
      <legend className="sr-only">Dates</legend>
      <DateField
        label={startLabel}
        value={value.start}
        rangeStart={value.start}
        rangeEnd={value.end}
        onChange={(start) => onChange({ start, end: value.end && value.end < start ? "" : value.end })}
      />
      <DateField
        label={endLabel}
        value={value.end}
        min={value.start || undefined}
        rangeStart={value.start}
        rangeEnd={value.end}
        onChange={(end) => onChange({ ...value, end })}
      />
    </fieldset>
  );
}

export interface TimeSlot {
  id: string;
  /** Display label in IST, e.g. "07:30". */
  label: string;
  /** Remaining capacity from the availability API; 0 renders disabled. */
  remaining: number;
}

export function TimeSlotPicker({
  slots,
  value,
  onChange,
  legend = "Choose a time",
}: {
  slots: TimeSlot[];
  value: string | null;
  onChange: (slotId: string) => void;
  legend?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((slot) => {
          const soldOut = slot.remaining <= 0;
          const checked = value === slot.id;
          return (
            <label
              key={slot.id}
              className={cn(
                "flex cursor-pointer flex-col items-center rounded-md border px-2 py-2.5 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent-text",
                checked ? "border-fg bg-fg text-surface" : "border-line-strong hover:border-fg",
                soldOut && "cursor-not-allowed opacity-50 hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name={name}
                value={slot.id}
                checked={checked}
                disabled={soldOut}
                onChange={() => onChange(slot.id)}
                className="sr-only"
              />
              <span className="text-sm font-semibold tabular-nums">{slot.label}</span>
              <span className={cn("text-xs", checked ? "text-surface/80" : "text-fg-muted")}>
                {soldOut ? "Full" : `${slot.remaining} left`}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function GuestStepper({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const btn =
    "inline-flex size-9 items-center justify-center rounded-full border border-line-strong text-fg transition-colors hover:border-fg disabled:opacity-40 disabled:hover:border-line-strong";
  return (
    <div className="flex items-center justify-between gap-4 py-2" role="group" aria-labelledby={id}>
      <div className="flex flex-col">
        <span id={id} className="text-[0.9375rem] font-semibold">
          {label}
        </span>
        {description ? <span className="text-sm text-fg-muted">{description}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <output aria-live="polite" className="w-6 text-center font-semibold tabular-nums">
          {value}
        </output>
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
