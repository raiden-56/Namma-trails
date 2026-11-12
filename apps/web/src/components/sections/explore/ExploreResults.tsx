"use client";

import { SearchX } from "lucide-react";
import { categoryShelves } from "@/config/categories";
import { useServices } from "@/lib/api/hooks";
import { Button } from "@/components/ui/Button";
import { ServiceResultCard } from "@/features/booking/ServiceResultCard";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import type { ExploreFilterState } from "./ExploreFilters";

const toPaise = (rupees: string) => (rupees ? Number(rupees) * 100 : undefined);

export function ExploreResults({ filters }: { filters: ExploreFilterState }) {
  const shelf = categoryShelves.find((s) => s.slug === filters.type);
  const query = useServices({
    destination: filters.destination || undefined,
    categories: shelf?.categories,
    guests: filters.guests,
    minPricePaise: toPaise(filters.minPrice),
    maxPricePaise: toPaise(filters.maxPrice),
    minRating: filters.minRating ? Number(filters.minRating) : undefined,
    // "recommended" is the UI name for the API's relevance ordering.
    sort: filters.sort === "recommended" ? "relevance" : filters.sort,
    page: filters.page,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading results">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/2] rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="We couldn't load results"
        description={query.error.message}
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const items = query.data.data;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="No listings match these filters"
        description="Try another destination, type or price range. Only verified partners with published listings appear here."
        action={
          <Button href="/destinations" variant="secondary" size="sm">
            Browse destinations
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-fg-muted" aria-live="polite">
        {query.data.meta.total} result{query.data.meta.total === 1 ? "" : "s"}
      </p>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => (
          <li key={s.id}>
            <ServiceResultCard s={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}
