import type { BookingStatus } from "./state-machine.js";

/**
 * A trip groups independent bookings that may belong to different providers.
 * It is NOT an atomic reservation: each booking has its own lifecycle, and the
 * trip status is derived from its components so the traveler always sees the
 * real state of each part.
 */
export type TripStatus =
  | "planning" //            all items still drafts
  | "checkout_in_progress" // holds/payment in flight for at least one item
  | "action_required" //     something needs the traveler (payment due, item failed/expired/rejected)
  | "awaiting_providers" //  paid or held; waiting on provider confirmation
  | "confirmed" //           every active item confirmed
  | "partially_confirmed" // some confirmed, others cancelled/failed
  | "in_progress"
  | "completed"
  | "cancelled";

const ACTIVE_LOST: BookingStatus[] = ["failed", "expired", "cancelled", "refunded", "refund_pending", "partially_refunded"];

export function deriveTripStatus(items: readonly BookingStatus[]): TripStatus {
  if (items.length === 0) return "planning";
  const has = (...s: BookingStatus[]) => items.some((i) => s.includes(i));
  const all = (...s: BookingStatus[]) => items.every((i) => s.includes(i));

  if (all("draft")) return "planning";
  if (all(...ACTIVE_LOST, "draft")) return "cancelled";
  if (has("awaiting_payment") || has("disputed")) return "action_required";
  if (has("pending_availability")) return "checkout_in_progress";
  if (has("awaiting_provider_confirmation")) return "awaiting_providers";
  if (has("in_progress")) return "in_progress";

  const live = items.filter((i) => !ACTIVE_LOST.includes(i) && i !== "draft");
  const lost = items.some((i) => ACTIVE_LOST.includes(i));
  if (live.length > 0 && live.every((i) => i === "completed")) return "completed";
  if (live.every((i) => i === "confirmed" || i === "completed" || i === "cancellation_requested")) {
    return lost ? "partially_confirmed" : "confirmed";
  }
  return "action_required";
}
