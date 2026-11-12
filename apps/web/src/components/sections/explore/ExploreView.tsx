"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { categoryShelves } from "@/config/categories";
import { destinations } from "@/content/destinations";
import { cn } from "@/lib/cn";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { SearchBar } from "@/components/ui/SearchBar";
import { ExploreFilters, readFilters } from "./ExploreFilters";
import { ExploreResults } from "./ExploreResults";

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

export function ExploreView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = readFilters(searchParams);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const destinationName = destinations.find((d) => d.slug === filters.destination)?.name;
  const shelf = categoryShelves.find((s) => s.slug === filters.type);
  const heading = [shelf?.label ?? "Everything", destinationName ? `in ${destinationName}` : "on the coast"].join(" ");

  return (
    <div className="container-editorial flex flex-col gap-8 py-8 lg:py-12">
      <SearchBar
        destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))}
        initial={{ destination: filters.destination, shelf: filters.type, from: filters.from, to: filters.to, guests: filters.guests }}
        variant="inline"
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Search results</p>
          <h1 className="font-display text-display-md">{heading}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" leadingIcon={<SlidersHorizontal className="size-4" />} onClick={() => setFiltersOpen(true)}>
            Filters
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="hidden text-fg-muted sm:inline">
              Sort
            </span>
            <Select aria-label="Sort results" value={filters.sort} onValueChange={(sort) => update({ sort })} options={sortOptions} className="h-9 min-w-44 text-sm" />
          </div>
          <div role="group" aria-label="Result view" className="inline-flex rounded-full border border-line-strong p-0.5">
            {(
              [
                ["list", "List", LayoutGrid],
                ["map", "Map", MapIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold", view === value ? "bg-fg text-surface" : "text-fg-muted")}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+1rem)]">
            <ExploreFilters filters={filters} onChange={update} />
          </div>
        </aside>
        <div>
          {view === "list" ? (
            <ExploreResults filters={filters} />
          ) : (
            <MapView title="Results on the map" markers={[]} />
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" placement="bottom" footer={<Button onClick={() => setFiltersOpen(false)}>Show results</Button>}>
        <ExploreFilters filters={filters} onChange={update} />
      </Sheet>
    </div>
  );
}
