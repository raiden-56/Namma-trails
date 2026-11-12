import { DomainError } from "../errors.js";
import { applyBps, type Paise } from "../money.js";

/**
 * A provider-chosen cancellation policy, e.g.
 *   ≥ 48h before start → 100%, ≥ 24h → 50%, otherwise 0%.
 * Tiers are evaluated on hours remaining before the service starts.
 */
export interface CancellationPolicy {
  tiers: { minHoursBeforeStart: number; refundBps: number }[];
  /** Whether the platform convenience fee is refunded on traveler-initiated cancellations. */
  platformFeeRefundable: boolean;
}

/**
 * Who cancelled. Anything other than the traveler (provider cancelled,
 * platform/safety cancellation, weather closure) refunds in full.
 */
export type CancellationInitiator = "traveler" | "provider" | "platform" | "weather";

export interface PaidBreakdown {
  taxableValue: Paise;
  serviceTax: Paise;
  platformFee: Paise;
  platformFeeTax: Paise;
  deposit: Paise;
}

export interface RefundComputation {
  refundBps: number;
  serviceRefund: Paise;
  serviceTaxRefund: Paise;
  platformFeeRefund: Paise;
  depositRefund: Paise;
  total: Paise;
  /** Share of the original booking that is reversed out of the provider's settlement (bps). */
  settlementReversalBps: number;
  reason: string;
}

export function refundBpsFor(policy: CancellationPolicy, hoursBeforeStart: number): number {
  const tier = [...policy.tiers]
    .sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart)
    .find((t) => hoursBeforeStart >= t.minHoursBeforeStart);
  return tier?.refundBps ?? 0;
}

export function validateCancellationPolicy(policy: CancellationPolicy): void {
  for (const t of policy.tiers) {
    if (t.refundBps < 0 || t.refundBps > 10_000 || !Number.isInteger(t.refundBps)) {
      throw new DomainError("INVALID_POLICY", "refundBps must be an integer between 0 and 10000", { tier: t });
    }
  }
  const sorted = [...policy.tiers].sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.refundBps > sorted[i - 1]!.refundBps) {
      throw new DomainError("INVALID_POLICY", "Cancelling later must never refund more than cancelling earlier");
    }
  }
}

export function computeRefund(args: {
  policy: CancellationPolicy;
  paid: PaidBreakdown;
  serviceStartAt: Date;
  cancelledAt: Date;
  initiatedBy: CancellationInitiator;
  /** Amount already refunded for this booking (partial refunds). */
  alreadyRefunded?: Paise;
}): RefundComputation {
  const { policy, paid, initiatedBy } = args;
  const hoursBefore = (args.serviceStartAt.getTime() - args.cancelledAt.getTime()) / 3_600_000;
  const full = initiatedBy !== "traveler";
  const refundBps = full ? 10_000 : refundBpsFor(policy, hoursBefore);

  const serviceRefund = applyBps(paid.taxableValue, refundBps);
  const serviceTaxRefund = applyBps(paid.serviceTax, refundBps);
  const feeRefundable = full || (policy.platformFeeRefundable && refundBps > 0);
  const platformFeeRefund = feeRefundable ? paid.platformFee + paid.platformFeeTax : 0;
  const depositRefund = paid.deposit; // deposits are held, never earned, on a cancelled booking

  const gross = serviceRefund + serviceTaxRefund + platformFeeRefund + depositRefund;
  const paidTotal = paid.taxableValue + paid.serviceTax + paid.platformFee + paid.platformFeeTax + paid.deposit;
  const remaining = paidTotal - (args.alreadyRefunded ?? 0);
  const total = Math.max(0, Math.min(gross, remaining));

  return {
    refundBps,
    serviceRefund,
    serviceTaxRefund,
    platformFeeRefund,
    depositRefund,
    total,
    settlementReversalBps: refundBps,
    reason: full
      ? `Full refund: cancelled by ${initiatedBy}`
      : `${refundBps / 100}% refund under the cancellation policy (${Math.max(0, Math.floor(hoursBefore))}h before start)`,
  };
}
