import { describe, expect, it } from "vitest";
import { allocate, applyBps, buildQuote, type PricingConfig } from "../src/index.js";

const rupees = (r: number) => r * 100;

describe("money", () => {
  it("rounds bps half-up to whole paise", () => {
    expect(applyBps(rupees(1000), 1800)).toBe(rupees(180));
    expect(applyBps(333, 5000)).toBe(167); // 166.5 → 167
  });
  it("allocates without losing a paisa", () => {
    const parts = allocate(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });
});

describe("pricing engine", () => {
  it("prices a shared boat ride per person with children", () => {
    const cfg: PricingConfig = { model: "per_person", currency: "INR", baseAmount: rupees(500), childAmount: rupees(300) };
    const q = buildQuote(cfg, { adults: 2, children: 1, date: "2026-12-10" });
    expect(q.serviceSubtotal).toBe(rupees(1300));
    expect(q.total).toBe(rupees(1300));
  });

  it("prices nightly stays per night with weekend seasonal rules and slab-based tax", () => {
    const cfg: PricingConfig = {
      model: "per_unit_per_night",
      currency: "INR",
      baseAmount: rupees(4000),
      includedOccupancy: 2,
      extraAdultAmount: rupees(800),
      seasonalRules: [
        { id: "wknd", label: "Weekend", from: "2026-01-01", to: "2026-12-31", daysOfWeek: [5, 6], adjustmentBps: 2500, priority: 1 },
      ],
      // Illustrative configurable slabs; actual rates are set by finance, not code.
      taxes: [
        { code: "GST", label: "GST", rateBps: 500, maxUnitAmount: rupees(7500) },
        { code: "GST", label: "GST", rateBps: 1800, minUnitAmount: rupees(7500) },
      ],
    };
    // 2026-12-11 is a Friday, 12-12 Saturday, 12-13 Sunday → nights Fri, Sat
    const q = buildQuote(cfg, { checkIn: "2026-12-11", checkOut: "2026-12-13", units: 1, adults: 3 });
    expect(q.billable).toEqual({ quantity: 2, unit: "nights" });
    // base 2×4000 + weekend 2×1000 + 1 extra adult ×2 nights ×800
    expect(q.serviceSubtotal).toBe(rupees(8000 + 2000 + 1600));
    expect(q.serviceTax).toBe(applyBps(rupees(11600), 500));
  });

  it("rejects a stay over room occupancy when extra beds are not offered", () => {
    const cfg: PricingConfig = { model: "per_unit_per_night", currency: "INR", baseAmount: rupees(2000), includedOccupancy: 2 };
    expect(() => buildQuote(cfg, { checkIn: "2026-12-01", checkOut: "2026-12-02", adults: 3 })).toThrow(/occupancy/);
  });

  it("bills rentals in rounded-up days with a refundable deposit that is not taxed", () => {
    const cfg: PricingConfig = {
      model: "per_unit_per_day",
      currency: "INR",
      baseAmount: rupees(500),
      depositPerUnit: rupees(2000),
      taxes: [{ code: "GST", label: "GST", rateBps: 1800 }],
    };
    const q = buildQuote(cfg, {
      units: 1,
      pickupAt: new Date("2026-12-01T09:00:00+05:30"),
      returnAt: new Date("2026-12-03T10:00:00+05:30"), // 49h → 3 days
    });
    expect(q.billable.quantity).toBe(3);
    expect(q.taxableValue).toBe(rupees(1500));
    expect(q.serviceTax).toBe(rupees(270));
    expect(q.deposit).toBe(rupees(2000));
    expect(q.total).toBe(rupees(1500 + 270 + 2000));
  });

  it("applies the minimum fare for short taxi trips", () => {
    const cfg: PricingConfig = { model: "distance_based", currency: "INR", baseAmount: rupees(100), perKmAmount: rupees(15), minimumFare: rupees(300) };
    expect(buildQuote(cfg, { distanceKm: 5 }).total).toBe(rupees(300));
    expect(buildQuote(cfg, { distanceKm: 20.2 }).total).toBe(rupees(100 + 21 * 15));
  });

  it("applies coupons before tax and caps them", () => {
    const cfg: PricingConfig = { model: "flat", currency: "INR", baseAmount: rupees(2000), taxes: [{ code: "GST", label: "GST", rateBps: 500 }] };
    const q = buildQuote(cfg, {}, { coupon: { code: "COAST10", kind: "percent", percentBps: 1000, maxDiscount: rupees(150), fundedBy: "platform" } });
    expect(q.discount).toBe(rupees(150));
    expect(q.taxableValue).toBe(rupees(1850));
    expect(q.serviceTax).toBe(applyBps(rupees(1850), 500));
    expect(q.discountFundedBy).toBe("platform");
  });

  it("adds a transparent platform fee with its own tax line", () => {
    const cfg: PricingConfig = { model: "flat", currency: "INR", baseAmount: rupees(1000) };
    const q = buildQuote(cfg, {}, { platformFee: { label: "Convenience fee", flatAmount: rupees(20), taxRateBps: 1800 } });
    expect(q.lines.map((l) => l.kind)).toEqual(["base", "fee", "fee_tax"]);
    expect(q.total).toBe(rupees(1000 + 20) + applyBps(rupees(20), 1800));
  });
});
