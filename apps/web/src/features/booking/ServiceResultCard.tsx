import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import type { ServiceCard } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import { MediaFrame } from "@/components/media/MediaFrame";
import { Badge } from "@/components/ui/Badge";

/** Listing card for search results and inventory shelves. Every value comes from the search API. */
export function ServiceResultCard({ s }: { s: ServiceCard }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-surface-raised shadow-card" data-testid="service-card">
      <div className="relative">
        <MediaFrame
          src={s.coverImageUrl}
          alt={s.title}
          aspect="aspect-[3/2]"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          mediaClassName="transition-transform duration-700 ease-(--ease-editorial) group-hover:scale-[1.05]"
          showPlaceholderNote={false}
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge tone={s.confirmationPolicy === "instant" ? "success" : "info"} className="bg-surface-raised shadow-card">
            {s.confirmationPolicy === "instant" ? "Instant confirmation" : "Partner confirms"}
          </Badge>
          {s.isDemo ? (
            <Badge tone="warning" className="bg-butter text-ink shadow-card">
              Demo
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="flex items-center gap-1 text-xs font-semibold text-fg-muted">
          {s.categoryName} · <MapPin className="size-3" aria-hidden="true" /> {s.destinationName}
        </span>
        <h3 className="text-base font-semibold leading-snug">
          <Link href={`/services/${s.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {s.title}
          </Link>
        </h3>
        <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
          {s.providerName}
          {s.providerVerified ? (
            <span className="inline-flex items-center text-success" title="Verified partner">
              <BadgeCheck className="size-4" aria-hidden="true" />
              <span className="sr-only">Verified partner</span>
            </span>
          ) : null}
        </span>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {s.fromPricePaise !== null ? (
            <span className="text-sm">
              <span className="text-fg-muted">From </span>
              <span className="text-base font-semibold tabular-nums">{formatInrFromPaise(s.fromPricePaise)}</span>
              {s.priceUnitLabel ? <span className="text-fg-muted"> {s.priceUnitLabel}</span> : null}
            </span>
          ) : (
            <span className="text-sm text-fg-muted">Price on dates</span>
          )}
          {s.ratingAverage !== null && s.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
              <Star className="size-4 fill-butter text-butter-deep" aria-hidden="true" />
              {s.ratingAverage.toFixed(1)}
              <span className="font-normal text-fg-muted">({s.ratingCount})</span>
              <span className="sr-only">average rating from {s.ratingCount} verified reviews</span>
            </span>
          ) : (
            <span className="text-xs text-fg-muted">New</span>
          )}
        </div>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg ring-accent-text group-has-focus-visible:ring-2" />
    </article>
  );
}
