import { applyBps, type Paise } from "../money.js";

/**
 * Commission rules are admin-configured. A rule matches when every scope
 * field it sets equals the booking's value; unset fields are wildcards. The
 * most specific matching rule wins, then the highest priority.
 */
export interface CommissionRule {
  id: string;
  providerId?: string | null;
  categoryKey?: string | null;
  destinationId?: string | null;
  rateBps: number;
  fixedAmount?: Paise;
  validFrom?: Date | null;
  validTo?: Date | null;
  priority: number;
}

export interface CommissionContext {
  providerId: string;
  categoryKey: string;
  destinationId: string;
  at: Date;
}

export function resolveCommissionRule(rules: readonly CommissionRule[], ctx: CommissionContext): CommissionRule | null {
  let best: { rule: CommissionRule; specificity: number } | null = null;
  for (const rule of rules) {
    if (rule.validFrom && ctx.at < rule.validFrom) continue;
    if (rule.validTo && ctx.at >= rule.validTo) continue;
    let specificity = 0;
    let matches = true;
    for (const [field, value] of [
      ["providerId", ctx.providerId],
      ["categoryKey", ctx.categoryKey],
      ["destinationId", ctx.destinationId],
    ] as const) {
      const scoped = rule[field];
      if (scoped == null) continue;
      if (scoped !== value) {
        matches = false;
        break;
      }
      // Provider-specific deals outrank category-wide ones.
      specificity += field === "providerId" ? 4 : field === "categoryKey" ? 2 : 1;
    }
    if (!matches) continue;
    if (
      !best ||
      specificity > best.specificity ||
      (specificity === best.specificity && rule.priority > best.rule.priority)
    ) {
      best = { rule, specificity };
    }
  }
  return best?.rule ?? null;
}

export interface Withholding {
  code: string; // e.g. "GST_TCS", "TDS_194O" (rates configured by finance, subject to tax review)
  label: string;
  rateBps: number;
  base: "service_value" | "gross_including_tax";
}

export interface SettlementInput {
  taxableValue: Paise;
  serviceTax: Paise;
  discount: Paise;
  discountFundedBy: "platform" | "provider" | null;
}

export interface SettlementOptions {
  rule: CommissionRule | null;
  /** Tax charged by the platform on its commission, configured by finance. */
  commissionTaxBps: number;
  /** Who files and pays the service tax collected from the traveler. */
  serviceTaxRemittedBy: "provider" | "platform";
  withholdings?: Withholding[];
}

export interface Settlement {
  /** Value of the service from the provider's point of view (includes platform-funded discounts). */
  providerServiceValue: Paise;
  commission: Paise;
  commissionTax: Paise;
  withholdings: { code: string; label: string; amount: Paise }[];
  serviceTaxPassThrough: Paise;
  /** What the provider receives for this booking. */
  netPayout: Paise;
  /** Discount the platform absorbed. */
  platformDiscountCost: Paise;
  commissionRuleId: string | null;
}

export function computeSettlement(input: SettlementInput, opts: SettlementOptions): Settlement {
  const platformDiscountCost = input.discountFundedBy === "platform" ? input.discount : 0;
  const providerServiceValue = input.taxableValue + platformDiscountCost;
  const commission = opts.rule ? applyBps(providerServiceValue, opts.rule.rateBps) + (opts.rule.fixedAmount ?? 0) : 0;
  const commissionTax = applyBps(commission, opts.commissionTaxBps);
  const serviceTaxPassThrough = opts.serviceTaxRemittedBy === "provider" ? input.serviceTax : 0;
  const withholdings = (opts.withholdings ?? []).map((w) => ({
    code: w.code,
    label: w.label,
    amount: applyBps(w.base === "service_value" ? providerServiceValue : providerServiceValue + input.serviceTax, w.rateBps),
  }));
  const withheld = withholdings.reduce((a, w) => a + w.amount, 0);
  return {
    providerServiceValue,
    commission,
    commissionTax,
    withholdings,
    serviceTaxPassThrough,
    netPayout: providerServiceValue + serviceTaxPassThrough - commission - commissionTax - withheld,
    platformDiscountCost,
    commissionRuleId: opts.rule?.id ?? null,
  };
}
