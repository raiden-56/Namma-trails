import { MapPinned } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MapMarker {
  id: string;
  label: string;
  /** Coordinates come from verified provider/attraction records (PostGIS) — never estimated in the UI. */
  position?: { lat: number; lng: number };
  kind?: "service" | "attraction" | "pickup" | "boarding";
}

export interface MapViewProps {
  markers: MapMarker[];
  title: string;
  className?: string;
}

/**
 * Map abstraction. Concrete providers (Google Maps, Mappls, MapLibre…) plug in behind
 * this component via NEXT_PUBLIC_MAP_PROVIDER once keys and terms are in place.
 * Until then it renders an accessible list of the same places — no fake map tiles,
 * distances or routes.
 */
export function MapView({ markers, title, className }: MapViewProps) {
  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER;
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-line bg-surface-raised", className)}>
      <div className="relative flex aspect-[16/9] items-center justify-center bg-[radial-gradient(circle_at_30%_40%,var(--color-sea-light),transparent_55%),radial-gradient(circle_at_75%_70%,var(--color-sand),transparent_50%)] p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg bg-surface-raised/90 p-5 text-center shadow-card backdrop-blur">
          <MapPinned className="size-6 text-accent-text" aria-hidden="true" />
          <p className="text-sm font-semibold">{provider ? `Loading ${provider} map…` : "Interactive map not configured yet"}</p>
          <p className="text-xs text-fg-muted">Locations are listed below. Pins will show verified boarding, pickup and property points.</p>
        </div>
      </div>
      <figcaption className="border-t border-line p-4">
        <p className="mb-2 text-sm font-semibold">{title}</p>
        {markers.length ? (
          <ul className="flex flex-wrap gap-2">
            {markers.map((m) => (
              <li key={m.id} className="rounded-full bg-fg/6 px-3 py-1 text-xs font-medium">
                {m.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No mapped places yet.</p>
        )}
      </figcaption>
    </figure>
  );
}
