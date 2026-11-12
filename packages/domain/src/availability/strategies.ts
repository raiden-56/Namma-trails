import type { BookingModel } from "../catalog.js";
import { DomainError } from "../errors.js";
import { eachNight, istDateOf, type LocalDate } from "../time.js";

/**
 * Availability is computed from facts the API loads inside a transaction
 * (capacity, committed reservations, unexpired holds, blackouts). These pure
 * functions decide; the database enforces with row locks / exclusion
 * constraints so two concurrent checkouts cannot both take the last unit.
 */

export interface AvailabilityResult {
  available: boolean;
  /** Units/seats left after this request would be taken (≥ 0 when available). */
  remaining: number;
  reason?:
    | "sold_out"
    | "blackout"
    | "slot_closed"
    | "weather_closed"
    | "private_slot_taken"
    | "no_resource_free"
    | "insufficient_capacity"
    | "outside_booking_window";
  detail?: Record<string, unknown>;
}

const ok = (remaining: number): AvailabilityResult => ({ available: true, remaining });
const no = (reason: AvailabilityResult["reason"], remaining = 0, detail?: Record<string, unknown>): AvailabilityResult =>
  detail ? { available: false, remaining, reason, detail } : { available: false, remaining, reason };

/* ---------- Booking-window rules shared by every model ---------- */

export interface BookingWindowRules {
  /** Minimum notice before the service starts, in minutes. */
  minLeadMinutes: number;
  /** How far ahead bookings are accepted, in days. */
  maxAdvanceDays: number;
  blackoutDates: readonly LocalDate[];
}

export function checkBookingWindow(rules: BookingWindowRules, startAt: Date, now: Date, dates: readonly LocalDate[]): AvailabilityResult | null {
  const leadMinutes = (startAt.getTime() - now.getTime()) / 60_000;
  if (leadMinutes < rules.minLeadMinutes) return no("outside_booking_window", 0, { leadMinutes, minLeadMinutes: rules.minLeadMinutes });
  if (leadMinutes > rules.maxAdvanceDays * 1440) return no("outside_booking_window", 0, { maxAdvanceDays: rules.maxAdvanceDays });
  const blocked = dates.filter((d) => rules.blackoutDates.includes(d));
  if (blocked.length) return no("blackout", 0, { dates: blocked });
  return null;
}

/* ---------- slot_capacity: boats, water sports, adventure, experiences ---------- */

export interface SlotState {
  capacity: number; // seats/participants for shared, or 1 boat for private
  committed: number; // seats in confirmed/in-progress bookings
  held: number; // seats in unexpired holds
  status: "open" | "closed" | "weather_hold";
  /** True when the slot was already sold as a private charter. */
  privatelyBooked: boolean;
}

export function slotAvailability(slot: SlotState, request: { seats: number; mode: "shared" | "private" }): AvailabilityResult {
  if (slot.status === "weather_hold") return no("weather_closed");
  if (slot.status === "closed") return no("slot_closed");
  if (slot.privatelyBooked) return no("private_slot_taken");
  const used = slot.committed + slot.held;
  if (request.mode === "private") {
    if (used > 0) return no("private_slot_taken", slot.capacity - used);
    if (request.seats > slot.capacity) return no("insufficient_capacity", slot.capacity);
    return ok(0);
  }
  const left = slot.capacity - used;
  if (left <= 0) return no("sold_out");
  if (request.seats > left) return no("insufficient_capacity", left);
  return ok(left - request.seats);
}

/* ---------- nightly_inventory: rooms and cottages ---------- */

export interface NightlyInventory {
  /** Default units of this room type. */
  totalUnits: number;
  /** Per-date overrides set by the provider (e.g. rooms under maintenance). */
  unitOverrides: Readonly<Record<LocalDate, number>>;
  /** Units committed + held per date. */
  usedByDate: Readonly<Record<LocalDate, number>>;
  closedDates: readonly LocalDate[];
}

export function nightlyAvailability(inv: NightlyInventory, request: { checkIn: LocalDate; checkOut: LocalDate; units: number }): AvailabilityResult {
  const nights = eachNight(request.checkIn, request.checkOut);
  const closed = nights.filter((n) => inv.closedDates.includes(n));
  if (closed.length) return no("blackout", 0, { dates: closed });
  let minLeft = Number.POSITIVE_INFINITY;
  const short: LocalDate[] = [];
  for (const night of nights) {
    const total = inv.unitOverrides[night] ?? inv.totalUnits;
    const left = total - (inv.usedByDate[night] ?? 0);
    minLeft = Math.min(minLeft, left);
    if (left < request.units) short.push(night);
  }
  if (short.length) return no(minLeft <= 0 ? "sold_out" : "insufficient_capacity", Math.max(0, minLeft), { dates: short });
  return ok(minLeft - request.units);
}

/* ---------- time_range_rental: scooty, bikes, self-drive cars ---------- */

export interface Interval {
  start: Date;
  end: Date; // exclusive
}

/** Max number of intervals overlapping at any instant inside `window` (sweep line). */
export function maxConcurrent(intervals: readonly Interval[], window: Interval): number {
  const events: [number, number][] = [];
  for (const iv of intervals) {
    const s = Math.max(iv.start.getTime(), window.start.getTime());
    const e = Math.min(iv.end.getTime(), window.end.getTime());
    if (s < e) events.push([s, 1], [e, -1]);
  }
  // Ends sort before starts at the same instant: back-to-back rentals do not overlap.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let max = 0;
  for (const [, d] of events) {
    cur += d;
    max = Math.max(max, cur);
  }
  return max;
}

export function rentalAvailability(
  fleet: { totalUnits: number; turnaroundMinutes: number; reservations: readonly Interval[] },
  request: { pickupAt: Date; returnAt: Date; units: number },
): AvailabilityResult {
  if (request.returnAt <= request.pickupAt) throw new DomainError("INVALID_DATE_RANGE", "Return must be after pickup");
  const pad = fleet.turnaroundMinutes * 60_000;
  // Each existing reservation blocks its unit for turnaround time after return (cleaning, inspection).
  const padded = fleet.reservations.map((r) => ({ start: r.start, end: new Date(r.end.getTime() + pad) }));
  const busy = maxConcurrent(padded, { start: request.pickupAt, end: new Date(request.returnAt.getTime() + pad) });
  const left = fleet.totalUnits - busy;
  if (left <= 0) return no("sold_out");
  if (left < request.units) return no("insufficient_capacity", left);
  return ok(left - request.units);
}

/* ---------- assigned_trip / assigned_person: taxis, autos, guides ---------- */

export interface AssignableResource {
  id: string;
  active: boolean;
  /** Seats (vehicles) or max group size (guides). */
  capacity: number;
  /** Languages (guides) or vehicle class tags; empty = no constraint. */
  tags: readonly string[];
  busy: readonly Interval[];
}

export function freeResources(
  resources: readonly AssignableResource[],
  request: Interval & { partySize: number; requiredTags?: readonly string[] },
): AssignableResource[] {
  return resources.filter(
    (r) =>
      r.active &&
      r.capacity >= request.partySize &&
      (request.requiredTags ?? []).every((t) => r.tags.includes(t)) &&
      !r.busy.some((b) => b.start < request.end && request.start < b.end),
  );
}

export function assignmentAvailability(
  resources: readonly AssignableResource[],
  request: Interval & { partySize: number; requiredTags?: readonly string[] },
): AvailabilityResult {
  const free = freeResources(resources, request);
  if (free.length === 0) return no("no_resource_free");
  return ok(free.length - 1);
}

/** The calendar dates a request touches, for blackout checks. */
export function datesTouched(model: BookingModel, req: { date?: LocalDate; checkIn?: LocalDate; checkOut?: LocalDate; start?: Date; end?: Date }): LocalDate[] {
  if (model === "nightly_inventory" && req.checkIn && req.checkOut) return eachNight(req.checkIn, req.checkOut);
  if (req.start && req.end) {
    const out = new Set<LocalDate>();
    for (let t = req.start.getTime(); t < req.end.getTime(); t += 86_400_000) out.add(istDateOf(new Date(t)));
    out.add(istDateOf(new Date(req.end.getTime() - 1)));
    return [...out];
  }
  return req.date ? [req.date] : [];
}
