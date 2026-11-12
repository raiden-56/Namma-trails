import { randomBytes, randomUUID } from "node:crypto";
import type { Coupon, PricingConfig, PricingModel, TaxRule as DomainTaxRule } from "@kt/domain";
import type { PricePlan, SeasonalPriceRule, TaxRule } from "../../generated/prisma/client.js";

/** Short, unambiguous public references (no 0/O/1/I), e.g. "BK-7K3QX9MW". Never sequential. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function reference(prefix: "TR" | "BK" | "ST" | "INV"): string {
  const bytes = randomBytes(8);
  return `${prefix}-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export const toLocalDateString = (d: Date) => d.toISOString().slice(0, 10);

/** Maps a stored price plan (+ seasonal rules and the category's tax rules) to the domain pricing config. */
export function pricingConfigFor(plan: PricePlan & { seasonalRules: SeasonalPriceRule[] }, taxRules: TaxRule[], at: Date): PricingConfig {
  const taxes: DomainTaxRule[] = taxRules
    .filter((t) => t.validFrom <= at && (!t.validTo || t.validTo > at))
    .map((t) => ({
      code: t.code,
      label: t.label,
      rateBps: t.rateBps,
      ...(t.minUnitAmount !== null ? { minUnitAmount: t.minUnitAmount } : {}),
      ...(t.maxUnitAmount !== null ? { maxUnitAmount: t.maxUnitAmount } : {}),
    }));
  const opt = <K extends string, V>(key: K, value: V | null) => (value === null ? {} : ({ [key]: value } as Record<K, V>));
  return {
    model: plan.model as PricingModel,
    currency: "INR",
    baseAmount: plan.baseAmount,
    ...opt("childAmount", plan.childAmount),
    ...opt("perKmAmount", plan.perKmAmount),
    ...opt("minimumFare", plan.minimumFare),
    ...opt("includedOccupancy", plan.includedOccupancy),
    ...opt("extraAdultAmount", plan.extraAdultAmount),
    ...opt("minimumBillableUnits", plan.minimumBillableUnits),
    ...opt("depositPerUnit", plan.depositPerUnit),
    seasonalRules: plan.seasonalRules.map((r) => ({
      id: r.id,
      label: r.label,
      from: toLocalDateString(r.fromDate),
      to: toLocalDateString(r.toDate),
      ...(r.daysOfWeek.length ? { daysOfWeek: r.daysOfWeek } : {}),
      ...(r.overrideUnitAmount !== null ? { overrideUnitAmount: r.overrideUnitAmount } : {}),
      ...(r.adjustmentBps !== null ? { adjustmentBps: r.adjustmentBps } : {}),
      priority: r.priority,
    })),
    taxes,
  };
}

export function couponFromRow(row: {
  code: string;
  kind: "percent" | "fixed";
  percentBps: number | null;
  amount: number | null;
  maxDiscount: number | null;
  minSubtotal: number | null;
  fundedBy: "platform" | "provider";
}): Coupon {
  return {
    code: row.code,
    kind: row.kind,
    fundedBy: row.fundedBy,
    ...(row.percentBps !== null ? { percentBps: row.percentBps } : {}),
    ...(row.amount !== null ? { amount: row.amount } : {}),
    ...(row.maxDiscount !== null ? { maxDiscount: row.maxDiscount } : {}),
    ...(row.minSubtotal !== null ? { minSubtotal: row.minSubtotal } : {}),
  };
}

/** Human unit label for a pricing model, e.g. "per night". */
export function priceUnitLabel(model: string): string {
  return (
    {
      per_person: "per person",
      per_unit: "per boat",
      per_unit_per_night: "per night",
      per_unit_per_hour: "per hour",
      per_unit_per_day: "per day",
      distance_based: "per trip",
      flat: "per booking",
    } as Record<string, string>
  )[model] ?? "";
}

/**
 * Payment gateway abstraction. Production uses Razorpay (Phase 6); development
 * uses MockGateway, which env validation forbids in staging/production.
 */
export interface PaymentGateway {
  readonly name: string;
  createOrder(amountPaise: number, receipt: string): Promise<{ orderId: string }>;
  refund(gatewayPaymentId: string, amountPaise: number): Promise<{ refundId: string }>;
}

export class MockGateway implements PaymentGateway {
  readonly name = "mock";
  async createOrder() {
    return { orderId: `mock_order_${randomUUID().replace(/-/g, "").slice(0, 18)}` };
  }
  async refund() {
    return { refundId: `mock_rfnd_${randomUUID().replace(/-/g, "").slice(0, 18)}` };
  }
}
