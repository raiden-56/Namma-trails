"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import { categoryShelves } from "@/config/categories";
import { destinations } from "@/content/destinations";
import { Radio } from "@/components/ui/Choice";
import { Input } from "@/components/ui/Input";

export interface ExploreFilterState {
  destination: string;
  type: string;
  from: string;
  to: string;
  guests: number;
  sort: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  page: number;
}

export function readFilters(params: ReadonlyURLSearchParams): ExploreFilterState {
  return {
    destination: params.get("destination") ?? "",
    type: params.get("type") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    guests: Number(params.get("guests") ?? 2) || 2,
    sort: params.get("sort") ?? "recommended",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minRating: params.get("minRating") ?? "",
    page: Number(params.get("page") ?? 1) || 1,
  };
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1 border-b border-line pb-5">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Touch-friendly filter panel; every change writes to the URL (shareable, back-button friendly). */
export function ExploreFilters({ filters, onChange }: { filters: ExploreFilterState; onChange: (patch: Record<string, string | null>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Group title="Destination">
        <Radio name="destination" label="All launch destinations" checked={!filters.destination} onChange={() => onChange({ destination: null })} />
        {destinations.map((d) => (
          <Radio key={d.slug} name="destination" label={d.name} checked={filters.destination === d.slug} onChange={() => onChange({ destination: d.slug })} />
        ))}
      </Group>
      <Group title="Type">
        <Radio name="type" label="Everything" checked={!filters.type} onChange={() => onChange({ type: null })} />
        {categoryShelves.map((s) => (
          <Radio key={s.slug} name="type" label={s.label} checked={filters.type === s.slug} onChange={() => onChange({ type: s.slug })} />
        ))}
      </Group>
      <Group title="Price (₹)">
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Minimum price in rupees" inputMode="numeric" placeholder="Min" value={filters.minPrice} onChange={(e) => onChange({ minPrice: e.target.value.replace(/\D/g, "") })} />
          <Input aria-label="Maximum price in rupees" inputMode="numeric" placeholder="Max" value={filters.maxPrice} onChange={(e) => onChange({ maxPrice: e.target.value.replace(/\D/g, "") })} />
        </div>
      </Group>
      <Group title="Traveller rating">
        {[
          ["", "Any"],
          ["4", "4.0 and above"],
          ["4.5", "4.5 and above"],
        ].map(([value, label]) => (
          <Radio key={label} name="rating" label={label} checked={filters.minRating === value} onChange={() => onChange({ minRating: value || null })} />
        ))}
      </Group>
      <p className="text-xs text-fg-muted">Only verified partners with published listings appear in results.</p>
    </div>
  );
}
