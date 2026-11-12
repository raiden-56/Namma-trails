"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { categoryShelves } from "@/config/categories";
import { cn } from "@/lib/cn";
import { todayInIndia } from "@/lib/format";
import { Button } from "./Button";
import { Sheet } from "./Dialog";
import { GuestStepper } from "./DateFields";
import { DatePicker, formatPickedDate } from "./DatePicker";
import { Select } from "./Select";

export interface SearchValues {
  destination: string;
  shelf: string;
  from: string;
  to: string;
  guests: number;
}

export interface SearchBarProps {
  destinations: Array<{ slug: string; name: string }>;
  initial?: Partial<SearchValues>;
  /** "hero" floats on imagery; "inline" sits in page chrome (explore, category pages). */
  variant?: "hero" | "inline";
  className?: string;
}

function toQuery(values: SearchValues): string {
  const params = new URLSearchParams();
  if (values.destination) params.set("destination", values.destination);
  if (values.shelf) params.set("type", values.shelf);
  if (values.from) params.set("from", values.from);
  if (values.to) params.set("to", values.to);
  if (values.guests > 0) params.set("guests", String(values.guests));
  return params.toString();
}

const segment = "flex min-w-0 flex-1 flex-col gap-0.5 px-5 py-3 text-left";
const segLabel = "text-xs font-semibold text-fg-muted";
const segControl =
  "w-full min-w-0 appearance-none bg-transparent text-[0.9375rem] font-semibold text-fg outline-none placeholder:text-fg-subtle";

/** Unified search: destination × service type × dates × guests → /explore with query params. */
export function SearchBar({ destinations, initial, variant = "hero", className }: SearchBarProps) {
  const router = useRouter();
  const [values, setValues] = useState<SearchValues>({
    destination: initial?.destination ?? "",
    shelf: initial?.shelf ?? "",
    from: initial?.from ?? "",
    to: initial?.to ?? "",
    guests: initial?.guests ?? 2,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const today = todayInIndia();
  const set = <K extends keyof SearchValues>(key: K, value: SearchValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setSheetOpen(false);
    router.push(`/explore?${toQuery(values)}`);
  }

  const destinationName = destinations.find((d) => d.slug === values.destination)?.name;

  const fields = (layout: "row" | "stack") => {
    const row = layout === "row";
    // In the bar each part is a soft pill with a thin line between; in the sheet each is its own box.
    // The bar's parts share the width 1.3 : 1 : 1.7 (where : what : both dates), so the longest
    // town, category and date still fit on a 1024px screen.
    const box = row ? "rounded-full px-4 xl:px-5" : "rounded-md border border-line-strong px-4";
    const divider = row ? <span aria-hidden="true" className="my-2.5 w-px shrink-0 bg-line" /> : null;
    return (
      <>
        <Select
          insetLabel="Where"
          className={cn(box, row && "flex-[1.3]")}
          value={values.destination}
          onValueChange={(destination) => set("destination", destination)}
          options={[{ value: "", label: "Any launch destination" }, ...destinations.map((d) => ({ value: d.slug, label: d.name }))]}
        />
        {divider}
        <Select
          insetLabel="What"
          className={box}
          value={values.shelf}
          onValueChange={(shelf) => set("shelf", shelf)}
          options={[{ value: "", label: "Everything" }, ...categoryShelves.map((s) => ({ value: s.slug, label: s.label }))]}
        />
        {divider}
        <div className={cn("flex min-w-0", row ? "flex-[1.7]" : "gap-3")}>
          <DatePicker
            insetLabel="From"
            className={box}
            format="short"
            clearable
            min={today}
            value={values.from}
            rangeStart={values.from}
            rangeEnd={values.to}
            onValueChange={(from) => setValues((v) => ({ ...v, from, to: v.to && v.to < from ? "" : v.to }))}
          />
          {divider}
          <DatePicker
            insetLabel="To"
            className={box}
            format="short"
            clearable
            min={values.from || today}
            value={values.to}
            rangeStart={values.from}
            rangeEnd={values.to}
            onValueChange={(to) => set("to", to)}
          />
        </div>
        {divider}
        {row ? (
          <label className={cn(segment, "w-24 flex-none px-4 xl:w-32 xl:px-5")}>
            <span className={segLabel}>Guests</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              className={segControl}
              value={values.guests}
              onChange={(e) => set("guests", Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            />
          </label>
        ) : (
          <div className="rounded-md border border-line-strong px-4">
            <GuestStepper label="Guests" value={values.guests} min={1} max={30} onChange={(n) => set("guests", n)} />
          </div>
        )}
      </>
    );
  };

  return (
    <div className={className}>
      {/* ≥ lg: segmented bar */}
      <form
        role="search"
        aria-label="Search trips"
        onSubmit={submit}
        className={cn(
          "hidden items-stretch rounded-full border bg-surface-raised p-1.5 text-fg lg:flex",
          variant === "hero" ? "border-transparent shadow-lift" : "border-line-strong",
        )}
      >
        {fields("row")}
        <Button type="submit" size="lg" className="self-center" leadingIcon={<Search className="size-5" />}>
          Search
        </Button>
      </form>

      {/* < lg: compact trigger → bottom sheet */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-full border bg-surface-raised px-4 py-3 text-left text-fg lg:hidden",
          variant === "hero" ? "border-transparent shadow-lift" : "border-line-strong",
        )}
        aria-haspopup="dialog"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          <Search className="size-5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[0.9375rem] font-semibold">{destinationName ?? "Where are you headed?"}</span>
          <span className="flex items-center gap-3 truncate text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {categoryShelves.find((s) => s.slug === values.shelf)?.label ?? "Stays, boats, rentals…"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden="true" />
              {values.from ? formatPickedDate(values.from, "short") : "Any dates"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" aria-hidden="true" />
              {values.guests}
            </span>
          </span>
        </span>
      </button>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} placement="bottom" title="Plan your trip">
        <form role="search" aria-label="Search trips" onSubmit={submit} className="flex flex-col gap-3">
          {fields("stack")}
          <Button type="submit" size="lg" className="mt-2 w-full" leadingIcon={<Search className="size-5" />}>
            Search
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
