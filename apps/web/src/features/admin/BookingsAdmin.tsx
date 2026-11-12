"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { adminOps, type AdminBookingRow } from "@/lib/api/marketplace";
import { BOOKING_STATUSES, type BookingStatus } from "@kt/domain";
import { formatInrFromPaise } from "@/lib/format";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { ADMIN_DENIED, QueryState, fmtDateTime } from "@/features/partner/shared";

const PAGE_SIZE = 25;

export function BookingsAdmin() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const status = (BOOKING_STATUSES as readonly string[]).includes(params.get("status") ?? "") ? (params.get("status") as BookingStatus) : undefined;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(q);

  const list = useQuery({
    queryKey: ["admin", "bookings", q, status, page],
    queryFn: () => adminOps.bookings({ ...(q ? { q } : {}), ...(status ? { status } : {}), page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const href = (next: { q?: string; status?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const nq = next.q ?? q;
    const ns = next.status ?? status ?? "";
    if (nq) sp.set("q", nq);
    if (ns) sp.set("status", ns);
    if ((next.page ?? 1) > 1) sp.set("page", String(next.page));
    return sp.size ? `${pathname}?${sp}` : pathname;
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    router.replace(href({ q: search.trim() }));
  }

  const total = list.data?.meta.total ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="text-sm text-fg-muted">Every booking across partners and destinations. Times are in IST.</p>
        </div>
        <p className="text-sm text-fg-muted" data-testid="bookings-total">
          {list.data ? `${total} booking${total === 1 ? "" : "s"}` : null}
        </p>
      </div>

      <form onSubmit={submit} role="search" className="grid gap-3 rounded-lg border border-line bg-surface-raised p-3 md:grid-cols-[1fr_16rem_auto] md:items-end">
        <Field id="booking-search" label="Search">
          <Input type="search" placeholder="Reference, service, partner or traveller" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field id="booking-status" label="Status">
          <Select
            value={status ?? ""}
            onValueChange={(next) => router.replace(href({ status: next }))}
            options={[{ value: "", label: "All statuses" }, ...BOOKING_STATUSES.filter((s) => s !== "draft").map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]}
          />
        </Field>
        <Button type="submit" leadingIcon={<Search className="size-4" />}>
          Search
        </Button>
      </form>

      <QueryState isPending={list.isPending} error={list.error} what="bookings" deniedHint={ADMIN_DENIED}>
        {() => (
          <div className={list.isPlaceholderData ? "opacity-60" : undefined}>
            <Table<AdminBookingRow>
              caption="Bookings"
              density="compact"
              rows={list.data!.data}
              getRowKey={(b) => b.reference}
              columns={[
                {
                  key: "ref",
                  header: "Booking",
                  cell: (b) => (
                    <span className="flex flex-col">
                      <span className="font-semibold">{b.reference}</span>
                      <span className="text-xs text-fg-muted">booked {fmtDateTime(b.createdAt)}</span>
                    </span>
                  ),
                },
                {
                  key: "service",
                  header: "Service",
                  cell: (b) => (
                    <span className="flex flex-col">
                      <span>{b.service}</span>
                      <span className="text-xs text-fg-muted">
                        {b.provider} · {b.destination}
                      </span>
                    </span>
                  ),
                },
                { key: "traveller", header: "Traveller", cell: (b) => b.traveler },
                { key: "when", header: "Starts", cell: (b) => fmtDateTime(b.startsAt) },
                {
                  key: "total",
                  header: "Total",
                  align: "right",
                  cell: (b) => (
                    <span className="flex flex-col">
                      <span>{formatInrFromPaise(b.totalPaise)}</span>
                      {b.refundedPaise > 0 ? <span className="text-xs text-danger">−{formatInrFromPaise(b.refundedPaise)} refunded</span> : null}
                    </span>
                  ),
                },
                { key: "commission", header: "Commission", align: "right", cell: (b) => (b.commissionPaise !== null ? formatInrFromPaise(b.commissionPaise) : "—") },
                { key: "status", header: "Status", cell: (b) => <StatusChip kind="booking" status={b.status} /> },
              ]}
              empty={<EmptyState title="No bookings match" description="Try another search or status." />}
            />
          </div>
        )}
      </QueryState>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
