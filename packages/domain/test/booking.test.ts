import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  DomainError,
  TERMINAL_BOOKING_STATUSES,
  assertTransition,
  canTransition,
  deriveTripStatus,
  holdsInventory,
} from "../src/index.js";

describe("booking state machine", () => {
  it("defines transitions for every status and only targets known statuses", () => {
    for (const s of BOOKING_STATUSES) {
      expect(BOOKING_TRANSITIONS[s]).toBeDefined();
      for (const r of BOOKING_TRANSITIONS[s]) expect(BOOKING_STATUSES).toContain(r.to);
    }
  });

  it("follows the instant-booking happy path", () => {
    expect(canTransition("draft", "pending_availability", "traveler", "instant")).toBe(true);
    expect(canTransition("pending_availability", "awaiting_payment", "system", "instant")).toBe(true);
    expect(canTransition("awaiting_payment", "confirmed", "system", "instant")).toBe(true);
    expect(canTransition("confirmed", "completed", "provider", "instant")).toBe(true);
  });

  it("routes request-to-book through provider confirmation before payment", () => {
    expect(canTransition("pending_availability", "awaiting_payment", "system", "request")).toBe(false);
    expect(canTransition("pending_availability", "awaiting_provider_confirmation", "system", "request")).toBe(true);
    expect(canTransition("awaiting_provider_confirmation", "awaiting_payment", "provider", "request")).toBe(true);
  });

  it("never lets the client confirm a booking — only verified payment (system) can", () => {
    for (const actor of ["traveler", "provider", "admin"] as const) {
      expect(canTransition("awaiting_payment", "confirmed", actor, "instant")).toBe(false);
    }
  });

  it("rejects illegal jumps with a typed error", () => {
    expect(() => assertTransition("draft", "confirmed", "traveler", "instant")).toThrow(DomainError);
    try {
      assertTransition("refunded", "confirmed", "admin", "instant");
    } catch (e) {
      expect((e as DomainError).code).toBe("BOOKING_INVALID_TRANSITION");
    }
  });

  it("treats terminal statuses as terminal and releases inventory", () => {
    expect(TERMINAL_BOOKING_STATUSES).toEqual(expect.arrayContaining(["cancelled", "refunded", "failed", "expired"]));
    for (const s of TERMINAL_BOOKING_STATUSES) expect(holdsInventory(s)).toBe(false);
    expect(holdsInventory("awaiting_payment")).toBe(true);
  });
});

describe("trip status derivation", () => {
  it("is confirmed only when every live booking is confirmed", () => {
    expect(deriveTripStatus(["confirmed", "confirmed"])).toBe("confirmed");
  });
  it("reports partial confirmation when a component failed", () => {
    expect(deriveTripStatus(["confirmed", "failed"])).toBe("partially_confirmed");
  });
  it("asks for action while a payment is due", () => {
    expect(deriveTripStatus(["confirmed", "awaiting_payment"])).toBe("action_required");
  });
  it("waits on providers for request-to-book items", () => {
    expect(deriveTripStatus(["confirmed", "awaiting_provider_confirmation"])).toBe("awaiting_providers");
  });
  it("is cancelled when nothing is live", () => {
    expect(deriveTripStatus(["cancelled", "refunded"])).toBe("cancelled");
  });
  it("is completed when all live items completed", () => {
    expect(deriveTripStatus(["completed", "completed", "cancelled"])).toBe("completed");
  });
});
