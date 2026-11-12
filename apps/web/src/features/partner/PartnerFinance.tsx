"use client";

import { useQuery } from "@tanstack/react-query";
import { partner, type PartnerFinance as Finance } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { KpiTile } from "@/components/ui/Display";
import { EmptyState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { PageHeader, QueryState, fmtDate, usePartnerId } from "./shared";

export const PAYOUT_LABEL: Record<string, string> = { scheduled: "Scheduled", processing: "Processing", paid: "Paid", failed: "Failed", on_hold: "On hold" };

export function PartnerFinance() {
  const providerId = usePartnerId();
  const q = useQuery({ queryKey: ["partner", "finance", providerId], queryFn: () => partner.finance(providerId!), enabled: Boolean(providerId), retry: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Finance" description="What you have earned, what is on its way and what has been paid out." />
      <QueryState isPending={q.isPending} error={q.error} what="finance">
        {() => {
          const f = q.data!.data;
          return (
            <>
              <section aria-label="Earnings summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <KpiTile label="Gross service value" value={formatInrFromPaise(f.grossServiceValuePaise)} hint="Before commission" />
                <KpiTile label="Commission + tax" value={formatInrFromPaise(f.commissionPaise + f.commissionTaxPaise)} hint={`${formatInrFromPaise(f.commissionTaxPaise)} of it is tax on commission`} />
                <KpiTile label="Refund adjustments" value={formatInrFromPaise(f.refundAdjustmentsPaise)} hint="Reversed for cancellations" />
                <KpiTile label="Net earnings" value={formatInrFromPaise(f.netEarningsPaise)} hint={`Includes ${formatInrFromPaise(f.taxCollectedPaise)} tax collected for you`} />
                <KpiTile label="Pending settlement" value={formatInrFromPaise(f.pendingSettlementPaise)} hint="Paid out after completion + dispute window" />
                <KpiTile label="Paid out" value={formatInrFromPaise(f.paidOutPaise)} />
              </section>

              <section aria-labelledby="settlements" className="flex flex-col gap-3">
                <h2 id="settlements" className="text-base font-semibold">
                  Recent bookings
                </h2>
                <Table<Finance["settlements"][number]>
                  caption="Earnings per booking"
                  rows={f.settlements}
                  getRowKey={(r) => r.reference}
                  columns={[
                    {
                      key: "booking",
                      header: "Booking",
                      cell: (r) => (
                        <span className="flex flex-col">
                          <span>{r.service}</span>
                          <span className="text-xs text-fg-muted">
                            {r.reference} · {fmtDate(r.startsAt)}
                          </span>
                        </span>
                      ),
                    },
                    { key: "status", header: "Status", cell: (r) => <StatusChip kind="booking" status={r.bookingStatus} /> },
                    { key: "total", header: "Guest paid", align: "right", cell: (r) => formatInrFromPaise(r.bookingTotalPaise) },
                    { key: "commission", header: "Commission", align: "right", cell: (r) => formatInrFromPaise(r.commissionPaise) },
                    { key: "net", header: "You earn", align: "right", cell: (r) => <span className="font-semibold">{formatInrFromPaise(r.netPaise)}</span> },
                    {
                      key: "payout",
                      header: "Payout",
                      cell: (r) =>
                        r.paidOut ? (
                          <Badge tone="success">Paid</Badge>
                        ) : r.netPaise <= 0 ? (
                          <Badge tone="neutral">Nothing to pay</Badge>
                        ) : r.eligible ? (
                          <Badge tone="info">In next payout</Badge>
                        ) : (
                          <Badge tone="neutral">Not yet eligible</Badge>
                        ),
                    },
                  ]}
                  empty={<EmptyState title="No earnings yet" description="Earnings appear once guests pay for their bookings." />}
                />
              </section>

              <section aria-labelledby="payouts" className="flex flex-col gap-3">
                <h2 id="payouts" className="text-base font-semibold">
                  Payouts
                </h2>
                <Table<Finance["payouts"][number]>
                  caption="Payouts"
                  rows={f.payouts}
                  getRowKey={(p) => p.id}
                  columns={[
                    { key: "period", header: "Period", cell: (p) => `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` },
                    { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{formatInrFromPaise(p.amountPaise)}</span> },
                    { key: "status", header: "Status", cell: (p) => <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "info"}>{PAYOUT_LABEL[p.status] ?? p.status}</Badge> },
                    { key: "paid", header: "Paid on", align: "right", cell: (p) => (p.paidAt ? fmtDate(p.paidAt) : "—") },
                  ]}
                  empty={<EmptyState title="No payouts yet" description="Payouts are sent once completed bookings pass the dispute window." />}
                />
              </section>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
