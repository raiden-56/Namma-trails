import type { PricingModel } from "../catalog.js";
import { DomainError } from "../errors.js";
import { applyBps, assertPaise, sum, type Paise } from "../money.js";
import { dayOfWeek, eachNight, hoursBetween, inRange, istDateOf, type LocalDate } from "../time.js";

/** A price adjustment for a date window (season, festival, long weekend). */
export interface SeasonalRule {
  id: string;
  label: string;
  from: LocalDate;
  to: LocalDate; // inclusive
  /** Restrict to these weekdays (0 = Sun). Omit for every day. */
  daysOfWeek?: number[];
  /** Either replace the base unit price, or adjust it by bps (+ or −). */
  overrideUnitAmount?: Paise;
  adjustmentBps?: number;
  /** Higher priority wins when several rules match one date. */
  priority: number;
}

/** A tax line, configured per category or service and never hard-coded. Slabs allow tariff-dependent rates such as accommodation GST. */
export interface TaxRule {
  code: string; // e.g. "GST"
  label: string;
  rateBps: number;
  /** Applies only when the effective per-unit price is inside this slab (inclusive min, exclusive max). */
  minUnitAmount?: Paise;
  maxUnitAmount?: Paise;
}

export interface PricingConfig {
  model: PricingModel;
  currency: "INR";
  /** Base price per pricing unit (person, unit-night, unit-hour, booking, …). */
  baseAmount: Paise;
  /** distance_based: price per km on top of baseAmount. */
  perKmAmount?: Paise;
  /** distance_based: minimum chargeable fare. */
  minimumFare?: Paise;
  /** per_person: price for a child (falls back to baseAmount). */
  childAmount?: Paise;
  /** per_unit_per_night: occupancy included per unit, and price per extra adult per night. */
  includedOccupancy?: number;
  extraAdultAmount?: Paise;
  /** per_unit_per_hour / per_unit_per_day: minimum billable units of time. */
  minimumBillableUnits?: number;
  /** Refundable security deposit collected per unit (rentals). Not taxed, not commissionable. */
  depositPerUnit?: Paise;
  seasonalRules?: SeasonalRule[];
  taxes?: TaxRule[];
}

export interface QuoteRequest {
  /** Units of inventory: rooms, vehicles, boats, guides. Defaults to 1. */
  units?: number;
  adults?: number;
  children?: number;
  /** Calendar date of the service (slot date, trip date, guide date). */
  date?: LocalDate;
  checkIn?: LocalDate;
  checkOut?: LocalDate;
  pickupAt?: Date;
  returnAt?: Date;
  distanceKm?: number;
}

export interface Coupon {
  code: string;
  kind: "percent" | "fixed";
  percentBps?: number;
  amount?: Paise;
  maxDiscount?: Paise;
  minSubtotal?: Paise;
  /** Who pays for the discount. Provider-funded discounts reduce the provider's earnings; platform-funded do not. */
  fundedBy: "platform" | "provider";
}

export interface PlatformFee {
  label: string;
  /** Applied to the discounted subtotal. */
  rateBps?: number;
  flatAmount?: Paise;
  taxRateBps?: number;
}

export type QuoteLineKind = "base" | "seasonal" | "extra_guest" | "discount" | "tax" | "fee" | "fee_tax" | "deposit";

export interface QuoteLine {
  kind: QuoteLineKind;
  label: string;
  amount: Paise; // discounts are negative
  meta?: Record<string, unknown>;
}

export interface Quote {
  currency: "INR";
  lines: QuoteLine[];
  /** Pre-discount service value (base + seasonal + extras). */
  serviceSubtotal: Paise;
  discount: Paise;
  discountFundedBy: Coupon["fundedBy"] | null;
  /** serviceSubtotal − discount; the taxable value and the commission base. */
  taxableValue: Paise;
  serviceTax: Paise;
  platformFee: Paise;
  platformFeeTax: Paise;
  deposit: Paise;
  /** Amount the traveler pays now. */
  total: Paise;
  /** Billable units of time/quantity used, for display ("2 nights", "3 days"). */
  billable: { quantity: number; unit: string };
}

interface UnitPrice {
  date: LocalDate | null;
  base: Paise;
  adjusted: Paise;
  rule?: SeasonalRule;
}

function priceForDate(config: PricingConfig, date: LocalDate | null): UnitPrice {
  const base = config.baseAmount;
  if (!date || !config.seasonalRules?.length) return { date, base, adjusted: base };
  const dow = dayOfWeek(date);
  const rule = config.seasonalRules
    .filter((r) => inRange(date, r.from, r.to) && (!r.daysOfWeek || r.daysOfWeek.includes(dow)))
    .sort((a, b) => b.priority - a.priority)[0];
  if (!rule) return { date, base, adjusted: base };
  const adjusted =
    rule.overrideUnitAmount !== undefined ? rule.overrideUnitAmount : base + applyBps(base, rule.adjustmentBps ?? 0);
  return { date, base, adjusted: Math.max(0, adjusted), rule };
}

function positiveInt(value: number | undefined, fallback: number, label: string): number {
  const v = value ?? fallback;
  if (!Number.isInteger(v) || v < 0) throw new DomainError("INVALID_QUANTITY", `${label} must be a non-negative integer`, { value });
  return v;
}

function computeService(config: PricingConfig, req: QuoteRequest) {
  const units = positiveInt(req.units, 1, "units");
  const adults = positiveInt(req.adults, 1, "adults");
  const children = positiveInt(req.children, 0, "children");
  if (units < 1) throw new DomainError("INVALID_QUANTITY", "At least one unit is required");
  const lines: QuoteLine[] = [];
  let billable = { quantity: 1, unit: "booking" };
  /** Effective per-unit price, used to pick tax slabs. */
  let effectiveUnitPrice = config.baseAmount;

  const pushPriced = (prices: UnitPrice[], multiplier: number, unitLabel: string) => {
    const baseTotal = sum(prices.map((p) => p.base)) * multiplier;
    const adjustedTotal = sum(prices.map((p) => p.adjusted)) * multiplier;
    lines.push({ kind: "base", label: `${multiplier} × ${prices.length} ${unitLabel}`, amount: baseTotal });
    if (adjustedTotal !== baseTotal) {
      const labels = [...new Set(prices.map((p) => p.rule?.label).filter(Boolean))].join(", ");
      lines.push({ kind: "seasonal", label: labels || "Seasonal pricing", amount: adjustedTotal - baseTotal });
    }
    effectiveUnitPrice = Math.max(...prices.map((p) => p.adjusted));
  };

  switch (config.model) {
    case "per_person": {
      if (adults + children < 1) throw new DomainError("INVALID_QUANTITY", "At least one participant is required");
      const p = priceForDate(config, req.date ?? null);
      const childPrice =
        config.childAmount !== undefined && p.base > 0
          ? Math.round((config.childAmount * p.adjusted) / p.base)
          : p.adjusted;
      const adultLine = p.base * adults;
      lines.push({ kind: "base", label: `${adults} adult${adults === 1 ? "" : "s"}`, amount: adultLine });
      if (children > 0) {
        const childBase = config.childAmount ?? p.base;
        lines.push({ kind: "base", label: `${children} child${children === 1 ? "" : "ren"}`, amount: childBase * children });
        const seasonalDelta = (p.adjusted - p.base) * adults + (childPrice - childBase) * children;
        if (seasonalDelta !== 0) lines.push({ kind: "seasonal", label: p.rule?.label ?? "Seasonal pricing", amount: seasonalDelta });
      } else if (p.adjusted !== p.base) {
        lines.push({ kind: "seasonal", label: p.rule?.label ?? "Seasonal pricing", amount: (p.adjusted - p.base) * adults });
      }
      effectiveUnitPrice = p.adjusted;
      billable = { quantity: adults + children, unit: "person" };
      break;
    }
    case "per_unit": {
      pushPriced([priceForDate(config, req.date ?? null)], units, "slot");
      billable = { quantity: units, unit: "unit" };
      break;
    }
    case "flat": {
      pushPriced([priceForDate(config, req.date ?? null)], units, "booking");
      billable = { quantity: units, unit: "booking" };
      break;
    }
    case "per_unit_per_night": {
      if (!req.checkIn || !req.checkOut) throw new DomainError("DATES_REQUIRED", "checkIn and checkOut are required");
      const nights = eachNight(req.checkIn, req.checkOut);
      const prices = nights.map((d) => priceForDate(config, d));
      pushPriced(prices, units, nights.length === 1 ? "night" : "nights");
      const included = (config.includedOccupancy ?? 2) * units;
      const extraAdults = Math.max(0, adults - included);
      if (extraAdults > 0) {
        if (config.extraAdultAmount === undefined)
          throw new DomainError("OCCUPANCY_EXCEEDED", "Guests exceed the occupancy of the selected rooms", { adults, included });
        lines.push({
          kind: "extra_guest",
          label: `${extraAdults} extra adult${extraAdults === 1 ? "" : "s"} × ${nights.length} night${nights.length === 1 ? "" : "s"}`,
          amount: config.extraAdultAmount * extraAdults * nights.length,
        });
      }
      billable = { quantity: nights.length, unit: nights.length === 1 ? "night" : "nights" };
      break;
    }
    case "per_unit_per_hour":
    case "per_unit_per_day": {
      if (!req.pickupAt || !req.returnAt) throw new DomainError("DATES_REQUIRED", "pickupAt and returnAt are required");
      const hours = hoursBetween(req.pickupAt, req.returnAt);
      if (hours <= 0) throw new DomainError("INVALID_DATE_RANGE", "Return must be after pickup");
      const perDay = config.model === "per_unit_per_day";
      const rawUnits = perDay ? Math.ceil(hours / 24 - 1e-9) : Math.ceil(hours - 1e-9);
      const timeUnits = Math.max(rawUnits, config.minimumBillableUnits ?? 1);
      // Seasonal pricing for rentals uses the pickup date for every billed unit.
      const p = priceForDate(config, istDateOf(req.pickupAt));
      pushPriced(Array.from({ length: timeUnits }, () => p), units, perDay ? "days" : "hours");
      billable = { quantity: timeUnits, unit: perDay ? (timeUnits === 1 ? "day" : "days") : timeUnits === 1 ? "hour" : "hours" };
      break;
    }
    case "distance_based": {
      if (req.distanceKm === undefined || !(req.distanceKm >= 0))
        throw new DomainError("DISTANCE_REQUIRED", "A distance estimate from the map provider is required");
      const p = priceForDate(config, req.date ?? null);
      const km = Math.ceil(req.distanceKm);
      const fare = p.adjusted + (config.perKmAmount ?? 0) * km;
      const charged = Math.max(fare, config.minimumFare ?? 0) * units;
      lines.push({ kind: "base", label: `Fare for ${km} km`, amount: charged, meta: { km } });
      effectiveUnitPrice = charged;
      billable = { quantity: km, unit: "km" };
      break;
    }
  }

  return { lines, units, billable, effectiveUnitPrice };
}

export function couponDiscount(coupon: Coupon, subtotal: Paise): Paise {
  if (coupon.minSubtotal !== undefined && subtotal < coupon.minSubtotal) return 0;
  let d = coupon.kind === "percent" ? applyBps(subtotal, coupon.percentBps ?? 0) : (coupon.amount ?? 0);
  if (coupon.maxDiscount !== undefined) d = Math.min(d, coupon.maxDiscount);
  return Math.max(0, Math.min(d, subtotal));
}

/**
 * Builds a transparent, line-itemised quote. The API always recomputes quotes
 * server-side; client-side quotes are for display only.
 */
export function buildQuote(
  config: PricingConfig,
  req: QuoteRequest,
  opts: { coupon?: Coupon; platformFee?: PlatformFee } = {},
): Quote {
  assertPaise(config.baseAmount, "baseAmount");
  const { lines, units, billable, effectiveUnitPrice } = computeService(config, req);
  const serviceSubtotal = sum(lines.map((l) => l.amount));

  const discount = opts.coupon ? couponDiscount(opts.coupon, serviceSubtotal) : 0;
  if (discount > 0 && opts.coupon) {
    lines.push({ kind: "discount", label: `Coupon ${opts.coupon.code}`, amount: -discount, meta: { fundedBy: opts.coupon.fundedBy } });
  }
  const taxableValue = serviceSubtotal - discount;

  let serviceTax = 0;
  for (const tax of config.taxes ?? []) {
    const inSlab =
      (tax.minUnitAmount === undefined || effectiveUnitPrice >= tax.minUnitAmount) &&
      (tax.maxUnitAmount === undefined || effectiveUnitPrice < tax.maxUnitAmount);
    if (!inSlab) continue;
    const amount = applyBps(taxableValue, tax.rateBps);
    serviceTax += amount;
    lines.push({ kind: "tax", label: `${tax.label} (${tax.rateBps / 100}%)`, amount, meta: { code: tax.code, rateBps: tax.rateBps } });
  }

  let platformFee = 0;
  let platformFeeTax = 0;
  if (opts.platformFee) {
    platformFee = (opts.platformFee.flatAmount ?? 0) + applyBps(taxableValue, opts.platformFee.rateBps ?? 0);
    if (platformFee > 0) {
      lines.push({ kind: "fee", label: opts.platformFee.label, amount: platformFee });
      platformFeeTax = applyBps(platformFee, opts.platformFee.taxRateBps ?? 0);
      if (platformFeeTax > 0) lines.push({ kind: "fee_tax", label: `Tax on ${opts.platformFee.label}`, amount: platformFeeTax });
    }
  }

  const deposit = (config.depositPerUnit ?? 0) * units;
  if (deposit > 0) lines.push({ kind: "deposit", label: "Refundable security deposit", amount: deposit });

  return {
    currency: "INR",
    lines,
    serviceSubtotal,
    discount,
    discountFundedBy: discount > 0 && opts.coupon ? opts.coupon.fundedBy : null,
    taxableValue,
    serviceTax,
    platformFee,
    platformFeeTax,
    deposit,
    total: taxableValue + serviceTax + platformFee + platformFeeTax + deposit,
    billable,
  };
}
