"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Map } from "lucide-react";
import { traveler, type TripBooking } from "@/lib/api/marketplace";
import type { BookingStatus } from "@/lib/catalog";
import { MediaFrame } from "@/components/media/MediaFrame";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { fmtRange } from "@/features/booking/format";
import { inrPaise } from "@/features/booking/PriceLines";

const CANCELLED: BookingStatus[] = ["cancelled", "refunded", "partially_refunded", "expired", "failed", "refund_pending", "cancellation_requested"];

function bucket(b: TripBooking): "upcoming" | "past" | "cancelled" {
  if (CANCELLED.includes(b.status)) return "cancelled";
  if (b.status === "completed" || b.status === "disputed") return "past";
  if (["awaiting_payment", "awaiting_provider_confirmation", "pending_availability", "in_progress"].includes(b.status)) return "upcoming";
  return new Date(b.endsAt).getTime() < Date.now() ? "past" : "upcoming";
}

function Row({ b }: { b: TripBooking }) {
  return (
    <li className="relative flex gap-3 rounded-xl border border-line bg-surface-raised p-3 sm:gap-4" data-testid="trip-row">
      <MediaFrame src={b.service.coverImageUrl} alt={b.service.title} className="size-20 shrink-0 rounded-lg sm:size-24" sizes="96px" showPlaceholderNote={false} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/trips/${b.reference}`} className="font-semibold leading-snug after:absolute after:inset-0 after:content-['']">
            {b.service.title}
          </Link>
          <StatusChip kind="booking" status={b.status} />
        </div>
        <p className="text-sm text-fg-muted">{fmtRange(b.startsAt, b.endsAt)}</p>
        <p className="text-xs text-fg-muted">
          {b.service.destination} · {b.reference} · {inrPaise(b.totalPaise)}
          {b.refundedPaise > 0 ? ` · refunded ${inrPaise(b.refundedPaise)}` : ""}
        </p>
        {b.pendingPayment ? (
          <div className="relative z-10 pt-1">
            <Button href={`/checkout/${b.reference}`} size="sm">
              Complete payment
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function List({ items, empty }: { items: TripBooking[]; empty: string }) {
  if (items.length === 0) return <EmptyState icon={<Map className="size-5" />} title={empty} action={<Button href="/explore">Find something to book</Button>} />;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((b) => (
        <Row key={b.id} b={b} />
      ))}
    </ul>
  );
}

export function TripsList() {
  const trips = useQuery({ queryKey: ["trips"], queryFn: traveler.trips });
  if (trips.isPending) return <Skeleton className="h-64" />;
  if (trips.isError) return <ErrorState title="We couldn't load your trips" description={trips.error.message} />;

  const all = trips.data.data;
  const upcoming = all.filter((b) => bucket(b) === "upcoming").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter((b) => bucket(b) === "past");
  const cancelled = all.filter((b) => bucket(b) === "cancelled");

  return (
    <Tabs
      label="Trips"
      items={[
        { id: "upcoming", label: "Upcoming", count: upcoming.length, content: <List items={upcoming} empty="No upcoming trips" /> },
        { id: "past", label: "Past", count: past.length, content: <List items={past} empty="No past trips yet" /> },
        { id: "cancelled", label: "Cancelled", count: cancelled.length, content: <List items={cancelled} empty="Nothing cancelled" /> },
      ]}
    />
  );
}
