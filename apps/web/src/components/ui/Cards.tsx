import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, BadgeCheck, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInrFromPaise } from "@/lib/format";
import { MediaFrame } from "@/components/media/MediaFrame";
import type { SceneName } from "@/components/media/PlaceholderScene";
import type { DestinationStatus } from "@/lib/catalog";
import { StatusChip } from "./Badge";

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "article" | "section" | "li" }) {
  return <As className={cn("rounded-lg border border-line bg-surface-raised p-5 shadow-card", className)}>{children}</As>;
}

/** Whole-card link pattern: one focusable link, stretched over the card; hover zooms media and nudges the arrow. */
export function DestinationCard({
  href,
  name,
  district,
  summary,
  image,
  scene,
  status,
  className,
  size = "md",
}: {
  href: string;
  name: string;
  district: string;
  summary: string;
  image: string | null;
  scene: SceneName;
  status?: DestinationStatus;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-xl bg-surface-raised shadow-card", className)}>
      <MediaFrame
        src={image}
        alt={`${name} coastline`}
        scene={scene}
        aspect={size === "lg" ? "aspect-[4/5]" : "aspect-[4/3]"}
        mediaClassName="transition-transform duration-700 ease-(--ease-editorial) group-hover:scale-[1.04]"
      />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-fg-muted">{district}</span>
          {status ? <StatusChip kind="destination" status={status} /> : null}
        </div>
        <h3 className={cn("font-display leading-tight", size === "lg" ? "text-display-sm" : "text-2xl")}>
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {name}
          </Link>
        </h3>
        <p className="text-[0.9375rem] leading-relaxed text-fg-muted">{summary}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-accent-text" aria-hidden="true">
          Explore {name}
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl ring-accent-text group-has-focus-visible:ring-2" />
    </article>
  );
}

export interface ServiceCardProps {
  href: string;
  title: string;
  providerName: string;
  providerVerified: boolean;
  locationLabel: string;
  categoryLabel: string;
  coverImageUrl: string | null;
  scene?: SceneName;
  fromPricePaise: number | null;
  priceUnitLabel: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

/** Listing card. Renders only API-supplied values; missing price/rating are omitted, never invented. */
export function ServiceCard(props: ServiceCardProps) {
  const { href, title, providerName, providerVerified, locationLabel, categoryLabel, coverImageUrl, scene = "coast" } = props;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg bg-surface-raised shadow-card">
      <MediaFrame
        src={coverImageUrl}
        alt={title}
        scene={scene}
        aspect="aspect-[3/2]"
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        mediaClassName="transition-transform duration-700 ease-(--ease-editorial) group-hover:scale-[1.05]"
        showPlaceholderNote={false}
      />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-xs font-semibold text-fg-muted">
          {categoryLabel} · {locationLabel}
        </span>
        <h3 className="text-base font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
          {providerName}
          {providerVerified ? (
            <span className="inline-flex items-center gap-0.5 text-success">
              <BadgeCheck className="size-4" aria-hidden="true" />
              <span className="sr-only">Verified partner</span>
            </span>
          ) : null}
        </span>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {props.fromPricePaise !== null ? (
            <span className="text-sm">
              <span className="text-fg-muted">From </span>
              <span className="text-base font-semibold tabular-nums">{formatInrFromPaise(props.fromPricePaise)}</span>
              {props.priceUnitLabel ? <span className="text-fg-muted"> / {props.priceUnitLabel}</span> : null}
            </span>
          ) : (
            <span className="text-sm text-fg-muted">Price on dates</span>
          )}
          {props.ratingAverage !== null && props.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
              <Star className="size-4 fill-butter text-butter-deep" aria-hidden="true" />
              {props.ratingAverage.toFixed(1)}
              <span className="font-normal text-fg-muted">({props.ratingCount})</span>
              <span className="sr-only">average rating from {props.ratingCount} verified reviews</span>
            </span>
          ) : null}
        </div>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg ring-accent-text group-has-focus-visible:ring-2" />
    </article>
  );
}
