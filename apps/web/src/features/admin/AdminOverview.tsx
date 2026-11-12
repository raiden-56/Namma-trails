"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { endpoints, type AdminApplication } from "@/lib/api/endpoints";
import type { DestinationStatus } from "@/lib/catalog";
import { formatInrFromPaise } from "@/lib/format";
import { StatusChip } from "@/components/ui/Badge";
import { KpiTile } from "@/components/ui/Display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";

interface PublicDestination {
  slug: string;
  name: string;
  status: DestinationStatus;
  categories: { key: string; listings: number; available: boolean }[];
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function AdminOverview() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: endpoints.adminOverview });
  const queue = useQuery({ queryKey: ["admin", "applications", "queue"], queryFn: () => endpoints.adminApplications() });
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: () => api.get<{ data: PublicDestination[] }>("/destinations"),
  });

  const m = overview.data?.data.marketplace;
  const b = overview.data?.data.bookings;
  const groups = [
    {
      title: "Marketplace",
      items: [
        { label: "Total users", value: m?.users, href: "/admin/users" },
        { label: "Total providers", value: m?.providers, href: "/admin/users?partnersOnly=true" },
        { label: "Pending applications", value: m?.pendingApplications },
        { label: "Approved providers", value: m?.approvedProviders },
        { label: "Suspended providers", value: m?.suspendedProviders },
        { label: "Active destinations", value: m?.activeDestinations },
        { label: "Active services", value: m?.activeServices },
      ],
    },
    {
      title: "Bookings & revenue",
      items: [
        { label: "Total bookings", value: b?.total },
        { label: "Confirmed", value: b?.confirmed },
        { label: "Cancelled", value: b?.cancelled },
        { label: "Gross booking value", value: b && formatInrFromPaise(b.grossBookingValuePaise) },
        { label: "Platform revenue", value: b && formatInrFromPaise(b.platformRevenuePaise) },
        { label: "Refunds", value: b && formatInrFromPaise(b.refundsPaise) },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-fg-muted">Live marketplace figures across all destinations.</p>
      </div>

      {overview.isError ? <ErrorState title="Couldn't load marketplace figures" description={overview.error.message} /> : null}

      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-fg-muted">{g.title}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {g.items.map((item) =>
              overview.isPending ? (
                <Skeleton key={item.label} className="h-22" />
              ) : (
                <div key={item.label} data-testid={`kpi-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {"href" in item && item.href ? (
                    <Link href={item.href} className="block rounded-lg transition hover:ring-2 hover:ring-fg/10">
                      <KpiTile label={item.label} value={item.value ?? null} density="compact" />
                    </Link>
                  ) : (
                    <KpiTile label={item.label} value={item.value ?? null} density="compact" />
                  )}
                </div>
              ),
            )}
          </div>
        </section>
      ))}

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="queue" className="flex flex-col gap-3 xl:col-span-2">
          <h2 id="queue" className="text-sm font-semibold">
            Provider applications awaiting review
          </h2>
          {queue.isError ? (
            <ErrorState title="Couldn't load the review queue" description={queue.error.message} />
          ) : queue.isPending ? (
            <Skeleton className="h-32" />
          ) : (
            <Table<AdminApplication>
              caption="Provider applications awaiting review"
              density="compact"
              rows={queue.data.data}
              getRowKey={(r) => r.id}
              columns={[
                { key: "business", header: "Business", cell: (r) => r.displayName },
                { key: "categories", header: "Categories", cell: (r) => r.categories.map((c) => c.key.replace(/_/g, " ")).join(", ") },
                { key: "district", header: "District", cell: (r) => r.district },
                { key: "status", header: "Status", cell: (r) => <StatusChip kind="provider" status={r.status} /> },
                { key: "submitted", header: "Submitted", cell: (r) => fmtDate(r.submittedAt), align: "right" },
              ]}
              empty={
                <EmptyState
                  title="No applications in the queue"
                  description="Applications appear here once a partner submits them for verification. Drafts still missing documents are not shown."
                />
              }
            />
          )}
        </section>

        <section aria-labelledby="readiness" className="flex flex-col gap-3">
          <h2 id="readiness" className="text-sm font-semibold">
            Destination readiness
          </h2>
          {destinations.isPending ? (
            <Skeleton className="h-40" />
          ) : destinations.isError ? (
            <ErrorState title="Couldn't load destinations" description={destinations.error.message} />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
              {destinations.data.data.map((d) => {
                const listings = d.categories.reduce((n, c) => n + c.listings, 0);
                return (
                  <li key={d.slug} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold">{d.name}</span>
                      <span className="ml-2 text-xs text-fg-muted">
                        {listings} live listing{listings === 1 ? "" : "s"}
                      </span>
                    </span>
                    <StatusChip kind="destination" status={d.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
