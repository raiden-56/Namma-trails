/**
 * Money is always integer paise (1 INR = 100 paise). Percentages are basis
 * points (1% = 100 bps). Never use floating-point rupees in business logic.
 */
export type Paise = number;

export function assertPaise(value: number, label = "amount"): asserts value is Paise {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer number of paise, got ${value}`);
}

/** Round half away from zero, the convention used on Indian invoices. */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** amount × bps / 10_000, rounded to the nearest paisa. */
export function applyBps(amount: Paise, bps: number): Paise {
  assertPaise(amount);
  if (!Number.isFinite(bps)) throw new RangeError(`bps must be finite, got ${bps}`);
  return roundHalfUp((amount * bps) / 10_000);
}

export function sum(values: readonly Paise[]): Paise {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Split `total` across `weights` into integers that add up exactly to `total`
 * (largest-remainder method). Used to spread a trip-level coupon across
 * bookings and to pro-rate refunds.
 */
export function allocate(total: Paise, weights: readonly number[]): Paise[] {
  assertPaise(total, "total");
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    const out = weights.map(() => 0);
    out[0] = total;
    return out;
  }
  const raw = weights.map((w) => (total * w) / weightSum);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = total - sum(floored);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] = (floored[i] ?? 0) + 1;
    remainder -= 1;
  }
  return floored;
}

export function formatINR(amount: Paise): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
