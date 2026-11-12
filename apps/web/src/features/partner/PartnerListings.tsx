"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Eye, Star, Ticket } from "lucide-react";
import { partner } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { PageHeader, QueryState, usePartnerId } from "./shared";

const UNIT: Record<string, string> = {
  per_person: "per person",
  per_unit: "per boat",
  per_unit_per_night: "per night",
  per_unit_per_hour: "per hour",
  per_unit_per_day: "per day",
  distance_based: "per trip",
  flat: "per booking",
};

export function PartnerListings() {
  const providerId = usePartnerId();
  const q = useQuery({ queryKey: ["partner", "listings", providerId], queryFn: () => partner.listings(providerId!), enabled: Boolean(providerId), retry: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Listings" description="Everything you offer on the marketplace and how each listing is doing." />
      <p className="rounded-lg border border-line bg-surface-raised p-3 text-sm text-fg-muted">
        Creating and editing listings (photos, prices, availability) arrives in Phase 4. Until then our team sets listings up with you.
      </p>
      <QueryState isPending={q.isPending} error={q.error} what="your listings">
        {() =>
          q.data!.data.length === 0 ? (
            <EmptyState title="No listings yet" description="Your listings appear here once they are set up." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {q.data!.data.map((l) => (
                <li key={l.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface-raised">
                  <div className="relative aspect-[16/9] bg-sand">
                    {l.coverImageUrl ? <Image src={l.coverImageUrl} alt={l.title} fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" /> : null}
                    <span className="absolute left-3 top-3">
                      <StatusChip kind="listing" status={l.status} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h2 className="font-semibold leading-snug">{l.title}</h2>
                    <p className="text-sm text-fg-muted">
                      {l.category} · {l.destination}
                    </p>
                    <p className="text-sm">
                      {l.fromPricePaise !== null ? (
                        <>
                          From <span className="font-semibold">{formatInrFromPaise(l.fromPricePaise)}</span> {l.priceUnitLabel ? UNIT[l.priceUnitLabel] ?? "" : ""}
                        </>
                      ) : (
                        "No price set"
                      )}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm text-fg-muted">
                      <span className="flex items-center gap-1">
                        <Star className="size-4" aria-hidden="true" />
                        {l.rating.average !== null ? `${l.rating.average.toFixed(1)} (${l.rating.count})` : "No reviews"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="size-4" aria-hidden="true" /> {l.views.toLocaleString("en-IN")} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Ticket className="size-4" aria-hidden="true" /> {l.bookings} bookings
                      </span>
                    </div>
                    <div>
                      <Badge tone={l.confirmationPolicy === "instant" ? "success" : "info"}>
                        {l.confirmationPolicy === "instant" ? "Instant booking" : "You confirm each request"}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}
