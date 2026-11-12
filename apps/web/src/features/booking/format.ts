import { todayInIndia } from "@/lib/format";

const IST = "Asia/Kolkata";

/** "YYYY-MM-DD" + n days (calendar arithmetic, no time zone drift). */
export function addDaysLocal(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const tomorrowInIndia = () => addDaysLocal(todayInIndia(), 1);

/** ISO instant for a wall-clock time in India, e.g. ("2026-12-01","09:00") → "2026-12-01T09:00:00+05:30". */
export const istIso = (date: string, time: string) => `${date}T${time}:00+05:30`;

export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", year: "numeric", ...opts }).format(new Date(iso));
}

export function fmtTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function fmtDateTime(iso: string | Date) {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

/** Calendar date (YYYY-MM-DD) for an instant, in India. */
export function istDate(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date(iso));
}

/** "Sat 14 Nov, 16:30–17:30" or a multi-day range. */
export function fmtRange(startIso: string, endIso: string) {
  if (istDate(startIso) === istDate(endIso)) return `${fmtDate(startIso)}, ${fmtTime(startIso)}–${fmtTime(endIso)}`;
  return `${fmtDateTime(startIso)} → ${fmtDateTime(endIso)}`;
}

/** Plain-language reasons for the availability codes returned by the API. */
export const AVAILABILITY_REASON: Record<string, string> = {
  sold_out: "Sold out for this selection.",
  insufficient_capacity: "Not enough left for your group — try fewer people or another time.",
  weather_closed: "Weather hold — the operator has paused this departure for safety.",
  slot_closed: "This departure is closed.",
  private_slot_taken: "This departure is already partly booked.",
  blackout: "The partner is closed on one of these dates.",
  outside_booking_window: "Too soon (or too far ahead) to book this time.",
  no_resource_free: "Nobody is free at that time — try another time or date.",
};
