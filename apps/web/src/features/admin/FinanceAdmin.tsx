"use client";

import { useQuery } from "@tanstack/react-query";
import { adminOps, type AdminFinance } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { KpiTile } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { PAYOUT_LABEL } from "@/features/partner/PartnerFinance";
import { ADMIN_DENIED, QueryState, fmtDate } from "@/features/partner/shared";

export function FinanceAdmin() {
  const q = useQuery({ queryKey: ["admin", "finance"], queryFn: adminOps.finance, retry: false });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-sm text-fg-muted">Booking value, platform revenue, refunds and partner payouts.</p>
      </div>
      <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        Tax rates, commission rules and the convenience fee are <strong>demo configuration</strong>. Confirm them with finance and tax advisors before launch.
      </p>
      <QueryState isPending={q.isPending} error={q.error} what="finance" deniedHint={ADMIN_DENIED}>
        {() => {
          const f = q.data!.data;
          const paid = f.payoutsByStatus.find((p) => p.status === "paid");
          return (
            <>
              <section aria-label="Totals" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                <KpiTile density="compact" label="Gross booking value" value={formatInrFromPaise(f.grossBookingValuePaise)} hint={`${f.paidBookings} paid bookings`} />
                <KpiTile density="compact" label="Commission" value={formatInrFromPaise(f.commissionPaise)} />
                <KpiTile density="compact" label="Tax on commission" value={formatInrFromPaise(f.commissionTaxPaise)} />
                <KpiTile density="compact" label="Convenience fees" value={formatInrFromPaise(f.convenienceFeesPaise)} />
                <KpiTile density="compact" label="Service tax collected" value={formatInrFromPaise(f.serviceTaxCollectedPaise)} />
                <KpiTile density="compact" label="Partner earnings" value={formatInrFromPaise(f.partnerEarningsPaise)} hint="Net of refunds" />
                <KpiTile density="compact" label="Refunds" value={formatInrFromPaise(f.refundsPaise)} hint={`${f.refundCount} refund${f.refundCount === 1 ? "" : "s"}`} />
                <KpiTile density="compact" label="Paid out" value={formatInrFromPaise(paid?.amountPaise ?? 0)} hint={`${paid?.count ?? 0} payouts`} />
              </section>

              <div className="grid gap-5 xl:grid-cols-2">
                <section aria-labelledby="by-category" className="flex flex-col gap-2">
                  <h2 id="by-category" className="text-sm font-semibold">
                    By category
                  </h2>
                  <Table<AdminFinance["byCategory"][number]>
                    caption="Revenue by category"
                    density="compact"
                    rows={f.byCategory}
                    getRowKey={(r) => r.category}
                    columns={[
                      { key: "category", header: "Category", cell: (r) => r.category },
                      { key: "bookings", header: "Bookings", align: "right", cell: (r) => r.bookings },
                      { key: "gbv", header: "Booking value", align: "right", cell: (r) => formatInrFromPaise(r.gbvPaise) },
                      { key: "commission", header: "Commission", align: "right", cell: (r) => formatInrFromPaise(r.commissionPaise) },
                    ]}
                    empty={<EmptyState title="No paid bookings yet" />}
                  />
                </section>

                <section aria-labelledby="payouts" className="flex flex-col gap-2">
                  <h2 id="payouts" className="text-sm font-semibold">
                    Partner payouts
                  </h2>
                  <Table<AdminFinance["payouts"][number]>
                    caption="Partner payouts"
                    density="compact"
                    rows={f.payouts}
                    getRowKey={(p) => p.id}
                    columns={[
                      { key: "provider", header: "Partner", cell: (p) => p.provider },
                      { key: "period", header: "Period", cell: (p) => `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` },
                      { key: "amount", header: "Amount", align: "right", cell: (p) => formatInrFromPaise(p.amountPaise) },
                      { key: "status", header: "Status", cell: (p) => <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "info"}>{PAYOUT_LABEL[p.status] ?? p.status}</Badge> },
                      { key: "paid", header: "Paid on", align: "right", cell: (p) => (p.paidAt ? fmtDate(p.paidAt) : "—") },
                    ]}
                    empty={<EmptyState title="No payouts yet" />}
                  />
                </section>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
