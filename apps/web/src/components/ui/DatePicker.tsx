"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type Ref } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { todayInIndia } from "@/lib/format";
import { controlClasses } from "./Input";
import { PopoverPanel, insetButtonClasses, insetLabelClasses, insetWrapClasses, useAnchoredPanel } from "./Popover";

/* Dates are plain "YYYY-MM-DD" strings, the same as the API uses. All the calendar maths is
   done on the date parts in UTC, so the visitor's own time zone can never shift a day. The
   names are written out here (not taken from Intl) so the server and the browser always
   print exactly the same text. */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parts(iso: string) {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** Builds a date string; out-of-range days and months roll over (day 0 is the last day of the month before). */
function iso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const { year, month, day } = parts(date);
  return iso(year, month, day + days);
}

/** Same day in another month, or that month's last day when it is shorter. */
function addMonths(date: string, months: number): string {
  const { year, month, day } = parts(date);
  const lastDay = parts(iso(year, month + months + 1, 0)).day;
  return iso(year, month + months, Math.min(day, lastDay));
}

function weekdayOf(date: string): number {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

const monthKey = (date: string) => date.slice(0, 7);

function clamp(date: string, min?: string, max?: string): string {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

/** "14 Nov 2026" (medium) or "Sat, 14 Nov" (short). */
export function formatPickedDate(date: string, format: "medium" | "short" = "medium"): string {
  if (!ISO_DATE.test(date)) return date;
  const { year, month, day } = parts(date);
  const monthName = MONTHS[month]?.slice(0, 3) ?? "";
  if (format === "short") return `${WEEKDAYS[weekdayOf(date)]?.slice(0, 3)}, ${day} ${monthName}`;
  return `${day} ${monthName} ${year}`;
}

function longDate(date: string): string {
  const { year, month, day } = parts(date);
  return `${WEEKDAYS[weekdayOf(date)]}, ${day} ${MONTHS[month]} ${year}`;
}

export interface DatePickerProps {
  /** "YYYY-MM-DD", or "" when no date is chosen. */
  value: string;
  onValueChange: (value: string) => void;
  /** First and last day that can be chosen ("YYYY-MM-DD"). */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Lets the visitor remove the date again. */
  clearable?: boolean;
  /** Shades the days between these two dates, for a from/to pair. */
  rangeStart?: string;
  rangeEnd?: string;
  format?: "medium" | "short";
  /** Draws this small label inside the control (search bar look) instead of the form-field look. */
  insetLabel?: string;
  /** Adds a hidden input with this name, so the value is sent with a plain form post. */
  name?: string;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

const navButton =
  "inline-flex size-9 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/**
 * Date field in the site's own style (a button that opens a month calendar), used in place
 * of the browser's date input. Keyboard in the calendar: arrows move by day and week,
 * Home/End go to the start/end of the week, Page Up/Down change the month, Enter or Space
 * chooses the day and Esc closes.
 */
export function DatePicker({
  value,
  onValueChange,
  min,
  max,
  placeholder = "Add date",
  clearable,
  rangeStart,
  rangeEnd,
  format = "medium",
  insetLabel,
  name,
  disabled,
  className,
  ref,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  /** The day the keyboard is on, and the month on show ("YYYY-MM"). */
  const [cursor, setCursor] = useState("");
  const [view, setView] = useState("");
  const [today, setToday] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  /** Set when the cursor moved by keyboard (or the calendar just opened), so focus should follow it. */
  const followFocus = useRef(false);
  const panelId = useId();
  const titleId = useId();
  const labelId = useId();
  const valueId = useId();
  const { anchorRef, panelRef } = useAnchoredPanel<HTMLDivElement>({ open, onClose: () => setOpen(false) });

  useEffect(() => {
    if (!open || !followFocus.current) return;
    followFocus.current = false;
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus({ preventScroll: true });
  }, [open, cursor, panelRef]);

  function setButton(node: HTMLButtonElement | null) {
    buttonRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  const selectable = (date: string) => (!min || date >= min) && (!max || date <= max);

  function show() {
    if (disabled) return;
    const now = todayInIndia();
    const start = clamp(ISO_DATE.test(value) ? value : now, min, max);
    setToday(now);
    setCursor(start);
    setView(monthKey(start));
    followFocus.current = true;
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function pick(date: string) {
    if (!selectable(date)) return;
    if (date !== value) onValueChange(date);
    close(true);
  }

  function moveCursor(date: string) {
    const next = clamp(date, min, max);
    followFocus.current = true;
    setCursor(next);
    setView(monthKey(next));
  }

  /** Previous / next month from the header buttons: the month changes, focus stays on the button. */
  function turnPage(months: number) {
    setView(monthKey(addMonths(`${view}-01`, months)));
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const day = weekdayOf(cursor);
    let next: string | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(cursor, -1);
        break;
      case "ArrowRight":
        next = addDays(cursor, 1);
        break;
      case "ArrowUp":
        next = addDays(cursor, -7);
        break;
      case "ArrowDown":
        next = addDays(cursor, 7);
        break;
      case "Home":
        next = addDays(cursor, -day);
        break;
      case "End":
        next = addDays(cursor, 6 - day);
        break;
      case "PageUp":
        next = addMonths(cursor, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = addMonths(cursor, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveCursor(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== "Escape") return;
    // Close the calendar only: without this an open <dialog> around it would close too.
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }

  /** Tabbing out of the control closes the calendar. */
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  const text = value ? formatPickedDate(value, format) : placeholder;

  const button = (
    <button
      ref={setButton}
      type="button"
      id={id}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-label={ariaLabel}
      aria-labelledby={insetLabel ? `${labelId} ${valueId}` : undefined}
      aria-describedby={insetLabel ? describedBy : [valueId, describedBy].filter(Boolean).join(" ")}
      disabled={disabled}
      onClick={() => (open ? close(false) : show())}
      className={
        insetLabel
          ? insetButtonClasses
          : cn(controlClasses, "flex h-11 items-center gap-2.5 text-left", open && "border-accent-text ring-3 ring-accent-text/25", className)
      }
      {...aria}
    >
      {insetLabel ? null : <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />}
      <span id={valueId} className={cn("min-w-0 truncate tabular-nums", !insetLabel && "flex-1", !value && "font-normal text-fg-subtle")}>
        {text}
      </span>
    </button>
  );

  let calendar = null;
  if (open && view) {
    const { year, month } = parts(`${view}-01`);
    const first = `${view}-01`;
    const dayCount = parts(iso(year, month + 1, 0)).day;
    const lead = weekdayOf(first);
    const cells: Array<string | null> = [...Array<null>(lead).fill(null), ...Array.from({ length: dayCount }, (_, i) => iso(year, month, i + 1))];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

    const canGoBack = !min || monthKey(min) < view;
    const canGoForward = !max || monthKey(max) > view;
    const from = rangeStart ?? "";
    const to = rangeEnd ?? "";
    const hasRange = from !== "" && to !== "" && from < to;
    const canPickToday = selectable(today);
    const canClear = Boolean(clearable && value);
    // The one day in this month that Tab lands on.
    const tabStop = monthKey(cursor) === view ? cursor : (cells.find((date) => date && selectable(date)) ?? null);

    calendar = (
      <PopoverPanel
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={`Choose ${(insetLabel ?? ariaLabel ?? "a").toLowerCase()} date`}
        tabIndex={-1}
        className="w-[19.5rem] max-w-[calc(100vw-1rem)] p-3 outline-none"
      >
        <div className="flex items-center justify-between gap-2">
          <button type="button" className={navButton} aria-label="Previous month" disabled={!canGoBack} onClick={() => turnPage(-1)}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <p id={titleId} aria-live="polite" className="font-display text-lg leading-none">
            {MONTHS[month]} {year}
          </p>
          <button type="button" className={navButton} aria-label="Next month" disabled={!canGoForward} onClick={() => turnPage(1)}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div role="grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown} className="mt-3 flex min-h-[17.75rem] flex-col">
          <div role="row" className="grid grid-cols-7 pb-1">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} role="columnheader" aria-label={weekday} className="py-1.5 text-center text-xs font-semibold text-fg-muted">
                {weekday.slice(0, 2)}
              </span>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div key={w} role="row" className="grid grid-cols-7">
              {week.map((date, d) => {
                if (!date) return <span key={d} role="gridcell" />;
                const isSelected = date === value;
                const isOtherEnd = !isSelected && (date === from || date === to);
                const isToday = date === today;
                const enabled = selectable(date);
                return (
                  <div
                    key={d}
                    role="gridcell"
                    aria-selected={isSelected}
                    className={cn(
                      "flex justify-center py-px",
                      hasRange && date > from && date < to && "bg-surface-sunken",
                      hasRange && date === from && "bg-[linear-gradient(90deg,transparent_50%,var(--surface-sunken)_50%)]",
                      hasRange && date === to && "bg-[linear-gradient(90deg,var(--surface-sunken)_50%,transparent_50%)]",
                    )}
                  >
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === tabStop ? 0 : -1}
                      disabled={!enabled}
                      aria-label={longDate(date)}
                      aria-current={isToday ? "date" : undefined}
                      onFocus={() => setCursor(date)}
                      onClick={() => pick(date)}
                      className={cn(
                        "relative flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors focus-visible:outline-offset-1",
                        isSelected ? "bg-fg font-semibold text-surface" : enabled && "hover:bg-fg/10",
                        isOtherEnd && "font-semibold ring-1 ring-inset ring-fg",
                        !enabled && "cursor-not-allowed text-fg-subtle opacity-45",
                        isToday && "after:absolute after:bottom-1.5 after:size-1 after:rounded-full after:bg-accent after:content-['']",
                      )}
                    >
                      {parts(date).day}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {canPickToday || canClear ? (
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5 text-sm">
            {canPickToday ? (
              <button type="button" className="rounded-sm px-2 py-1 font-semibold text-accent-text underline-offset-4 hover:underline" onClick={() => pick(today)}>
                Today
              </button>
            ) : (
              <span />
            )}
            {canClear ? (
              <button
                type="button"
                className="rounded-sm px-2 py-1 font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                onClick={() => {
                  onValueChange("");
                  close(true);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </PopoverPanel>
    );
  }

  const hidden = name ? <input type="hidden" name={name} value={value} /> : null;

  if (insetLabel) {
    return (
      <div ref={anchorRef} onBlur={onBlur} onKeyDown={onKeyDown} className={cn(insetWrapClasses, open && "bg-fg/5", className)}>
        <span id={labelId} className={insetLabelClasses}>
          {insetLabel}
        </span>
        {button}
        {hidden}
        {calendar}
      </div>
    );
  }

  return (
    <div ref={anchorRef} onBlur={onBlur} onKeyDown={onKeyDown} className="relative">
      {button}
      {hidden}
      {calendar}
    </div>
  );
}
