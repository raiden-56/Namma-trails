"use client";

import type { ReactNode } from "react";
import { useServices } from "@/lib/api/hooks";
import type { ServiceCategoryKey } from "@/lib/catalog";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ServiceResultCard } from "@/features/booking/ServiceResultCard";

/**
 * Renders published listings from the search API. While no verified partner has
 * published inventory (or the API is unreachable) it shows a designed onboarding
 * state — it never falls back to sample listings.
 */
export function LiveInventory({
  categories,
  destination,
  emptyTitle,
  emptyDescription,
  emptyAction,
  limit = 4,
}: {
  categories?: ServiceCategoryKey[];
  destination?: string;
  emptyTitle: string;
  emptyDescription: ReactNode;
  emptyAction?: ReactNode;
  limit?: number;
}) {
  const query = useServices({ destination, categories, pageSize: limit });

  if (query.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading listings">
        {Array.from({ length: limit }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/2] rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const items = query.data?.data.slice(0, limit) ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        tone="editorial"
        title={emptyTitle}
        description={
          <>
            {emptyDescription}
            {query.isError ? (
              <span className="mt-2 block text-sm">Live listings could not be loaded right now.</span>
            ) : null}
          </>
        }
        action={
          emptyAction ?? (
            <Button href="/partner/join" variant="secondary" size="sm">
              List your business
            </Button>
          )
        }
      />
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <li key={s.id}>
          <ServiceResultCard s={s} />
        </li>
      ))}
    </ul>
  );
}
