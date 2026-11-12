import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORG_ROLE_PERMISSIONS,
  DEFAULT_PLATFORM_ROLE_PERMISSIONS,
  assertProviderTransition,
  assignmentAvailability,
  can,
  checkBookingWindow,
  evaluateDocuments,
  isBookable,
  nightlyAvailability,
  publishBlockers,
  rentalAvailability,
  slotAvailability,
  type DocumentRequirement,
  type Principal,
} from "../src/index.js";

const d = (s: string) => new Date(s);

describe("availability strategies", () => {
  it("slot capacity counts holds and blocks private charters on partially sold slots", () => {
    const slot = { capacity: 10, committed: 6, held: 2, status: "open" as const, privatelyBooked: false };
    expect(slotAvailability(slot, { seats: 2, mode: "shared" })).toEqual({ available: true, remaining: 0 });
    expect(slotAvailability(slot, { seats: 3, mode: "shared" }).reason).toBe("insufficient_capacity");
    expect(slotAvailability(slot, { seats: 1, mode: "private" }).reason).toBe("private_slot_taken");
    expect(slotAvailability({ ...slot, status: "weather_hold" }, { seats: 1, mode: "shared" }).reason).toBe("weather_closed");
  });

  it("nightly inventory takes the minimum across every night", () => {
    const r = nightlyAvailability(
      { totalUnits: 5, unitOverrides: { "2026-12-12": 3 }, usedByDate: { "2026-12-11": 1, "2026-12-12": 2 }, closedDates: [] },
      { checkIn: "2026-12-11", checkOut: "2026-12-13", units: 2 },
    );
    expect(r.available).toBe(false);
    expect(r.remaining).toBe(1);
    expect(r.detail).toEqual({ dates: ["2026-12-12"] });
  });

  it("rentals respect turnaround time but allow back-to-back once it has passed", () => {
    const fleet = {
      totalUnits: 1,
      turnaroundMinutes: 60,
      reservations: [{ start: d("2026-12-01T09:00:00+05:30"), end: d("2026-12-01T18:00:00+05:30") }],
    };
    expect(rentalAvailability(fleet, { pickupAt: d("2026-12-01T18:30:00+05:30"), returnAt: d("2026-12-02T09:00:00+05:30"), units: 1 }).available).toBe(false);
    expect(rentalAvailability(fleet, { pickupAt: d("2026-12-01T19:00:00+05:30"), returnAt: d("2026-12-02T09:00:00+05:30"), units: 1 }).available).toBe(true);
  });

  it("assignment finds a free guide who speaks the requested language", () => {
    const guides = [
      { id: "g1", active: true, capacity: 10, tags: ["kn", "en"], busy: [{ start: d("2026-12-01T09:00:00+05:30"), end: d("2026-12-01T13:00:00+05:30") }] },
      { id: "g2", active: true, capacity: 10, tags: ["hi"], busy: [] },
    ];
    const req = { start: d("2026-12-01T10:00:00+05:30"), end: d("2026-12-01T14:00:00+05:30"), partySize: 4, requiredTags: ["en"] };
    expect(assignmentAvailability(guides, req).reason).toBe("no_resource_free");
    expect(assignmentAvailability(guides, { ...req, requiredTags: ["hi"] }).available).toBe(true);
  });

  it("enforces lead time and blackout dates", () => {
    const rules = { minLeadMinutes: 120, maxAdvanceDays: 180, blackoutDates: ["2026-12-25"] };
    const now = d("2026-12-01T09:00:00+05:30");
    expect(checkBookingWindow(rules, d("2026-12-01T10:00:00+05:30"), now, ["2026-12-01"])?.reason).toBe("outside_booking_window");
    expect(checkBookingWindow(rules, d("2026-12-25T10:00:00+05:30"), now, ["2026-12-25"])?.reason).toBe("blackout");
    expect(checkBookingWindow(rules, d("2026-12-02T10:00:00+05:30"), now, ["2026-12-02"])).toBeNull();
  });
});

describe("rbac", () => {
  const owner: Principal = {
    userId: "u1",
    platformPermissions: new Set(DEFAULT_PLATFORM_ROLE_PERMISSIONS.traveler),
    orgPermissions: new Map([["provA", new Set(DEFAULT_ORG_ROLE_PERMISSIONS.owner)]]),
  };
  it("scopes provider permissions to the provider's own organisation", () => {
    expect(can(owner, "org.booking.read", { providerId: "provA" })).toBe(true);
    expect(can(owner, "org.booking.read", { providerId: "provB" })).toBe(false);
    expect(can(owner, "org.booking.read")).toBe(false);
  });
  it("lets operators read only bookings assigned to them", () => {
    const op: Principal = { userId: "u9", platformPermissions: new Set(), orgPermissions: new Map([["provA", new Set(DEFAULT_ORG_ROLE_PERMISSIONS.operator)]]) };
    expect(can(op, "org.booking.read", { providerId: "provA", assignedUserId: "u9" })).toBe(true);
    expect(can(op, "org.booking.read", { providerId: "provA", assignedUserId: "u8" })).toBe(false);
    expect(can(op, "org.finance.read", { providerId: "provA" })).toBe(false);
  });
  it("keeps travelers to their own resources and out of admin", () => {
    expect(can(owner, "self.booking.read", { ownerUserId: "u1" })).toBe(true);
    expect(can(owner, "self.booking.read", { ownerUserId: "u2" })).toBe(false);
    expect(can(owner, "provider.application.review")).toBe(false);
  });
  it("does not give finance admins verification powers", () => {
    const fin: Principal = { userId: "f", platformPermissions: new Set(DEFAULT_PLATFORM_ROLE_PERMISSIONS.finance_admin), orgPermissions: new Map() };
    expect(can(fin, "finance.payout.manage")).toBe(true);
    expect(can(fin, "provider.document.read_private")).toBe(false);
  });
});

describe("provider onboarding", () => {
  const reqs: DocumentRequirement[] = [
    { documentTypeKey: "business_identity", label: "Business identity", categoryKeys: ["boating", "stay"], required: true, requiresExpiry: false, subject: "business" },
    { documentTypeKey: "boat_registration", label: "Boat registration", categoryKeys: ["boating"], required: true, requiresExpiry: true, subject: "boat" },
    { documentTypeKey: "insurance", label: "Insurance", categoryKeys: ["boating"], required: true, requiresExpiry: true, subject: "business" },
  ];
  it("lists missing, expired and expiring documents for the provider's categories only", () => {
    const ev = evaluateDocuments(
      reqs,
      [
        { documentTypeKey: "business_identity", status: "verified", expiresOn: null },
        { documentTypeKey: "insurance", status: "verified", expiresOn: "2026-12-20" },
      ],
      ["boating"],
      "2026-12-01",
    );
    expect(ev.missing.map((m) => m.documentTypeKey)).toEqual(["boat_registration"]);
    expect(ev.expiringSoon.map((m) => m.requirement.documentTypeKey)).toEqual(["insurance"]);
    expect(ev.readyToSubmit).toBe(false);

    const stayOnly = evaluateDocuments(reqs, [{ documentTypeKey: "business_identity", status: "verified", expiresOn: null }], ["stay"], "2026-12-01");
    expect(stayOnly.fullyVerified).toBe(true);
  });

  it("only allows legal provider status changes", () => {
    expect(() => assertProviderTransition("draft", "approved", "admin")).toThrow();
    expect(() => assertProviderTransition("draft", "submitted", "admin")).toThrow();
    expect(assertProviderTransition("under_review", "info_requested", "admin").event).toBe("info_requested");
  });

  it("keeps pending providers unbookable even with a published listing", () => {
    const gate = {
      providerStatus: "under_review" as const,
      providerDocumentsVerified: true,
      listingStatus: "published" as const,
      providerCategoryApproved: true,
      destinationStatus: "active" as const,
      categoryEnabledInDestination: true,
      assetDocumentsVerified: true,
    };
    expect(isBookable(gate)).toBe(false);
    expect(publishBlockers(gate)).toEqual(["provider_not_approved"]);
    expect(isBookable({ ...gate, providerStatus: "approved" })).toBe(true);
    expect(isBookable({ ...gate, providerStatus: "approved", destinationStatus: "onboarding" })).toBe(false);
  });
});
