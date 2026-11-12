import { describe, expect, it } from "vitest";
import {
  computeRefund,
  computeSettlement,
  resolveCommissionRule,
  validateCancellationPolicy,
  type CancellationPolicy,
  type CommissionRule,
} from "../src/index.js";

const rupees = (r: number) => r * 100;
const at = new Date("2026-12-01T00:00:00Z");

describe("commission resolution", () => {
  const rules: CommissionRule[] = [
    { id: "default", rateBps: 1200, priority: 0 },
    { id: "boating", categoryKey: "boating", rateBps: 1000, priority: 0 },
    { id: "promo-provider", providerId: "p1", rateBps: 500, priority: 0, validFrom: new Date("2026-11-01"), validTo: new Date("2027-01-01") },
    { id: "gokarna-stays", categoryKey: "stay", destinationId: "gok", rateBps: 1500, priority: 0 },
  ];
  it("prefers provider-specific deals while valid", () => {
    expect(resolveCommissionRule(rules, { providerId: "p1", categoryKey: "boating", destinationId: "gok", at })?.id).toBe("promo-provider");
    expect(
      resolveCommissionRule(rules, { providerId: "p1", categoryKey: "boating", destinationId: "gok", at: new Date("2027-02-01") })?.id,
    ).toBe("boating");
  });
  it("falls back from category+destination to category to default", () => {
    expect(resolveCommissionRule(rules, { providerId: "p2", categoryKey: "stay", destinationId: "gok", at })?.id).toBe("gokarna-stays");
    expect(resolveCommissionRule(rules, { providerId: "p2", categoryKey: "stay", destinationId: "udp", at })?.id).toBe("default");
  });
});

describe("settlement", () => {
  it("protects provider earnings from platform-funded discounts", () => {
    const s = computeSettlement(
      { taxableValue: rupees(900), serviceTax: rupees(45), discount: rupees(100), discountFundedBy: "platform" },
      { rule: { id: "r", rateBps: 1000, priority: 0 }, commissionTaxBps: 1800, serviceTaxRemittedBy: "provider" },
    );
    expect(s.providerServiceValue).toBe(rupees(1000));
    expect(s.commission).toBe(rupees(100));
    expect(s.commissionTax).toBe(rupees(18));
    expect(s.netPayout).toBe(rupees(1000 + 45 - 100 - 18));
    expect(s.platformDiscountCost).toBe(rupees(100));
  });
  it("deducts configured withholdings", () => {
    const s = computeSettlement(
      { taxableValue: rupees(1000), serviceTax: 0, discount: 0, discountFundedBy: null },
      {
        rule: { id: "r", rateBps: 1000, priority: 0 },
        commissionTaxBps: 0,
        serviceTaxRemittedBy: "provider",
        withholdings: [{ code: "W1", label: "Withholding", rateBps: 100, base: "service_value" }],
      },
    );
    expect(s.netPayout).toBe(rupees(1000 - 100 - 10));
  });
});

describe("refunds", () => {
  const policy: CancellationPolicy = {
    tiers: [
      { minHoursBeforeStart: 48, refundBps: 10_000 },
      { minHoursBeforeStart: 24, refundBps: 5_000 },
      { minHoursBeforeStart: 0, refundBps: 0 },
    ],
    platformFeeRefundable: false,
  };
  const paid = { taxableValue: rupees(1000), serviceTax: rupees(50), platformFee: rupees(20), platformFeeTax: 360, deposit: rupees(500) };
  const start = new Date("2026-12-10T10:00:00+05:30");

  it("validates that later cancellation never refunds more", () => {
    expect(() => validateCancellationPolicy(policy)).not.toThrow();
    expect(() =>
      validateCancellationPolicy({ platformFeeRefundable: false, tiers: [{ minHoursBeforeStart: 48, refundBps: 0 }, { minHoursBeforeStart: 0, refundBps: 5000 }] }),
    ).toThrow();
  });

  it("applies the matching tier for traveler cancellations and always returns deposits", () => {
    const r = computeRefund({ policy, paid, serviceStartAt: start, cancelledAt: new Date("2026-12-09T08:00:00+05:30"), initiatedBy: "traveler" });
    expect(r.refundBps).toBe(5000);
    expect(r.total).toBe(rupees(500) + rupees(25) + rupees(500));
    expect(r.platformFeeRefund).toBe(0);
  });

  it("refunds everything when the provider or weather cancels", () => {
    const r = computeRefund({ policy, paid, serviceStartAt: start, cancelledAt: new Date("2026-12-10T09:00:00+05:30"), initiatedBy: "weather" });
    expect(r.total).toBe(rupees(1000 + 50 + 20 + 500) + 360);
  });

  it("never refunds more than what remains", () => {
    const r = computeRefund({ policy, paid, serviceStartAt: start, cancelledAt: new Date("2026-12-01T00:00:00Z"), initiatedBy: "provider", alreadyRefunded: rupees(1500) });
    expect(r.total).toBe(rupees(1000 + 50 + 20 + 500) + 360 - rupees(1500));
  });
});
