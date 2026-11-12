import type { QuoteLine } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import { cn } from "@/lib/cn";

const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** Line amounts can carry paise (taxes); totals are shown to the paisa too so lines add up. */
export const inrPaise = (paise: number) => inrExact.format(paise / 100);

/** Transparent, line-itemised price breakdown exactly as the server computed it. */
export function PriceLines({ lines, total, totalLabel = "Total", className }: { lines: QuoteLine[]; total: number; totalLabel?: string; className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-1.5 text-sm", className)} data-testid="price-lines">
      {lines.map((l, i) => (
        <div key={`${l.kind}-${i}`} className="flex items-start justify-between gap-3">
          <dt className={cn("text-fg-muted", l.kind === "discount" && "text-success", l.kind === "deposit" && "italic")}>
            {l.label}
            {l.kind === "deposit" ? " (returned after your trip)" : ""}
          </dt>
          <dd className={cn("shrink-0 tabular-nums", l.kind === "discount" && "text-success")}>{l.amount < 0 ? `− ${inrPaise(-l.amount)}` : inrPaise(l.amount)}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-2 text-base font-semibold">
        <dt>{totalLabel}</dt>
        <dd className="tabular-nums" data-testid="price-total">
          {inrPaise(total)}
        </dd>
      </div>
    </dl>
  );
}

export { formatInrFromPaise };
