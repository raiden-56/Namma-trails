import { DomainError, article } from "../errors.js";

export const BOOKING_STATUSES = [
  "draft",
  "pending_availability",
  "awaiting_provider_confirmation",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancellation_requested",
  "cancelled",
  "refund_pending",
  "partially_refunded",
  "refunded",
  "failed",
  "expired",
  "disputed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingActor = "system" | "traveler" | "provider" | "admin";

/** instant: a verified payment confirms the booking. request: the provider must accept before payment is collected. */
export type ConfirmationPolicy = "instant" | "request";

export interface TransitionRule {
  to: BookingStatus;
  actors: readonly BookingActor[];
  /** Only valid under this confirmation policy (omitted = any). */
  policy?: ConfirmationPolicy;
  /** Stable event name written to booking_status_history and audit logs. */
  event: string;
}

const T = (to: BookingStatus, actors: BookingActor[], event: string, policy?: ConfirmationPolicy): TransitionRule =>
  policy ? { to, actors, event, policy } : { to, actors, event };

/**
 * The single source of truth for legal booking transitions. The API calls
 * `assertTransition` inside the DB transaction that writes the new status and a
 * booking_status_history row; an optimistic `version` column stops two
 * concurrent transitions from both succeeding.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly TransitionRule[]>> = {
  draft: [
    T("pending_availability", ["traveler", "system"], "checkout_started"),
    T("cancelled", ["traveler", "system"], "draft_abandoned"),
  ],
  pending_availability: [
    T("awaiting_payment", ["system"], "inventory_held", "instant"),
    T("awaiting_provider_confirmation", ["system"], "inventory_held", "request"),
    T("failed", ["system"], "inventory_unavailable"),
  ],
  awaiting_provider_confirmation: [
    T("awaiting_payment", ["provider", "admin"], "provider_accepted", "request"),
    T("cancelled", ["provider", "admin"], "provider_rejected"),
    T("cancelled", ["traveler"], "traveler_withdrew"),
    T("expired", ["system"], "provider_response_timeout"),
  ],
  awaiting_payment: [
    T("confirmed", ["system"], "payment_verified"),
    T("failed", ["system"], "payment_failed"),
    T("expired", ["system"], "hold_expired"),
    T("cancelled", ["traveler"], "traveler_abandoned"),
  ],
  confirmed: [
    T("in_progress", ["provider", "system"], "service_started"),
    T("completed", ["provider", "system", "admin"], "service_completed"),
    T("cancellation_requested", ["traveler"], "traveler_requested_cancellation"),
    T("refund_pending", ["provider", "admin", "system"], "cancelled_by_provider_or_platform"),
    T("disputed", ["traveler", "admin"], "dispute_opened"),
  ],
  in_progress: [
    T("completed", ["provider", "system", "admin"], "service_completed"),
    T("disputed", ["traveler", "admin"], "dispute_opened"),
  ],
  completed: [T("disputed", ["traveler", "admin"], "dispute_opened")],
  cancellation_requested: [
    T("refund_pending", ["system", "admin", "provider"], "cancellation_accepted"),
    T("cancelled", ["system", "admin"], "cancellation_accepted_no_refund_due"),
    T("confirmed", ["traveler", "admin"], "cancellation_withdrawn"),
  ],
  refund_pending: [
    T("refunded", ["system"], "refund_settled_full"),
    T("partially_refunded", ["system"], "refund_settled_partial"),
  ],
  disputed: [
    T("completed", ["admin"], "dispute_resolved_no_refund"),
    T("refund_pending", ["admin"], "dispute_resolved_with_refund"),
  ],
  partially_refunded: [T("disputed", ["traveler", "admin"], "dispute_opened")],
  cancelled: [],
  refunded: [],
  failed: [],
  expired: [],
};

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = BOOKING_STATUSES.filter(
  (s) => BOOKING_TRANSITIONS[s].length === 0,
);

/** Statuses during which the booking occupies inventory (a hold or a committed reservation). */
export const INVENTORY_HOLDING_STATUSES: readonly BookingStatus[] = [
  "pending_availability",
  "awaiting_provider_confirmation",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "cancellation_requested",
];

export function findTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
  policy: ConfirmationPolicy,
): TransitionRule | undefined {
  return BOOKING_TRANSITIONS[from].find(
    (r) => r.to === to && r.actors.includes(actor) && (r.policy === undefined || r.policy === policy),
  );
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
  policy: ConfirmationPolicy,
): boolean {
  return findTransition(from, to, actor, policy) !== undefined;
}

export function assertTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
  policy: ConfirmationPolicy,
): TransitionRule {
  const rule = findTransition(from, to, actor, policy);
  if (!rule) {
    throw new DomainError("BOOKING_INVALID_TRANSITION", `${article(actor)} ${actor} cannot move a booking from ${from} to ${to}`, {
      from,
      to,
      actor,
      policy,
    });
  }
  return rule;
}

export function holdsInventory(status: BookingStatus): boolean {
  return INVENTORY_HOLDING_STATUSES.includes(status);
}
