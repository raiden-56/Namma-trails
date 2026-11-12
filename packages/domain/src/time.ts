import { DomainError } from "./errors.js";

/**
 * All operating dates are calendar dates in Asia/Kolkata (IST, UTC+05:30, no DST).
 * Instants are stored as UTC timestamps; calendar dates (check-in, slot date) are
 * stored as `date` columns and passed around as "YYYY-MM-DD" strings.
 */
export type LocalDate = string;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export function assertLocalDate(value: string, label = "date"): asserts value is LocalDate {
  if (!LOCAL_DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new DomainError("INVALID_DATE", `${label} must be a YYYY-MM-DD calendar date`, { value });
  }
  // Reject impossible dates such as 2026-02-30 that Date.parse rolls over.
  if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new DomainError("INVALID_DATE", `${label} is not a real calendar date`, { value });
  }
}

function toUtcMidnight(d: LocalDate): number {
  return Date.parse(`${d}T00:00:00Z`);
}

export function addDays(d: LocalDate, days: number): LocalDate {
  return new Date(toUtcMidnight(d) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY);
}

/** The nights of a stay: every date from check-in up to but excluding check-out. */
export function eachNight(checkIn: LocalDate, checkOut: LocalDate): LocalDate[] {
  assertLocalDate(checkIn, "checkIn");
  assertLocalDate(checkOut, "checkOut");
  const n = daysBetween(checkIn, checkOut);
  if (n <= 0) throw new DomainError("INVALID_DATE_RANGE", "Check-out must be after check-in", { checkIn, checkOut });
  return Array.from({ length: n }, (_, i) => addDays(checkIn, i));
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function dayOfWeek(d: LocalDate): number {
  return new Date(toUtcMidnight(d)).getUTCDay();
}

/** The IST calendar date on which an instant falls. */
export function istDateOf(instant: Date): LocalDate {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instant of a wall-clock time ("HH:mm") on an IST calendar date. */
export function istInstant(date: LocalDate, time: string): Date {
  assertLocalDate(date);
  if (!/^\d{2}:\d{2}$/.test(time)) throw new DomainError("INVALID_TIME", "time must be HH:mm", { time });
  return new Date(Date.parse(`${date}T${time}:00+05:30`));
}

export function inRange(d: LocalDate, from: LocalDate, to: LocalDate): boolean {
  return d >= from && d <= to; // lexical comparison is valid for YYYY-MM-DD
}

export function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}
