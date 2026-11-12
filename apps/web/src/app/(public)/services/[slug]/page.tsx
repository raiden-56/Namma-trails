import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck, Check, Clock, CloudRain, Languages, MapPin, ShieldAlert, Star, Users, X } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { pageOpenGraph, shareImage } from "@/lib/seo";
import type { ServiceDetail } from "@/lib/api/marketplace";
import { MediaFrame } from "@/components/media/MediaFrame";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { BookingPanel } from "@/features/booking/BookingPanel";
import { fmtDate } from "@/features/booking/format";

type Params = { slug: string };

/** One API call per request (shared by metadata and page). Unknown or unpublished listings 404. */
const loadService = cache(async (slug: string): Promise<ServiceDetail | null> => {
  try {
    const res = await apiFetch<{ data: ServiceDetail }>(`/services/${encodeURIComponent(slug)}`, { cache: "no-store" });
    return res.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 422)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await loadService(slug);
  if (!s) return { title: "Listing not found", robots: { index: false, follow: true } };
  // Add the town to the title only when the listing name does not already say it.
  const title = s.title.toLowerCase().includes(s.destination.name.toLowerCase()) ? s.title : `${s.title} in ${s.destination.name}`;
  const description = (s.summary ?? s.description ?? "").slice(0, 155);
  return {
    title,
    description,
    keywords: [s.category.name, `${s.category.name} in ${s.destination.name}`, s.destination.name, s.provider.name],
    alternates: { canonical: `/services/${slug}` },
    openGraph: pageOpenGraph({
      url: `/services/${slug}`,
      title,
      description,
      images: s.images[0] ? shareImage(s.images[0].url, s.images[0].alt || s.title) : undefined,
    }),
  };
}

const LOCATION_LABEL: Record<string, string> = {
  boarding_point: "Boarding point",
  pickup_point: "Pickup point",
  meeting_point: "Meeting point",
  property: "Property",
  primary: "Location",
  drop_point: "Drop point",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const s = await loadService(slug);
  if (!s) notFound();
  const [hero, ...rest] = s.images;
  const hours = s.durationMinutes ? Math.round((s.durationMinutes / 60) * 10) / 10 : 0;
  const duration = s.durationMinutes ? (s.durationMinutes >= 60 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${s.durationMinutes} minutes`) : null;
  const side = rest.slice(0, 2);

  return (
    <div className="container-editorial flex flex-col gap-6 py-8 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: s.destination.name, href: `/destinations/${s.destination.slug}` },
          { label: s.category.name, href: `/explore?destination=${s.destination.slug}` },
          { label: s.title },
        ]}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{s.category.name}</Badge>
          {s.isDemo ? <Badge tone="warning">Demo listing</Badge> : null}
        </div>
        <h1 className="font-display text-display-md">{s.title}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
          {s.rating.average !== null && s.rating.count > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-fg">
              <Star className="size-4 fill-butter text-butter-deep" aria-hidden="true" />
              {s.rating.average.toFixed(1)} <span className="font-normal text-fg-muted">({s.rating.count} review{s.rating.count === 1 ? "" : "s"})</span>
            </span>
          ) : (
            <span>No reviews yet</span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" aria-hidden="true" /> {s.destination.name}, {s.destination.district}
          </span>
        </p>
      </div>

      {hero ? (
        <div className={side.length ? `grid gap-2 sm:grid-cols-4 ${side.length === 2 ? "sm:grid-rows-2" : "sm:grid-rows-1"}` : "grid"}>
          <MediaFrame
            src={hero.url}
            alt={hero.alt}
            priority
            aspect="aspect-[3/2] sm:aspect-auto"
            className={side.length ? `rounded-xl sm:col-span-3 sm:min-h-[22rem] ${side.length === 2 ? "sm:row-span-2" : ""}` : "rounded-xl sm:aspect-[21/9]"}
            sizes="(min-width: 640px) 70vw, 100vw"
          />
          {side.map((img) => (
            <MediaFrame key={img.url} src={img.url} alt={img.alt} aspect="aspect-[3/2] sm:aspect-auto" className="hidden rounded-xl sm:block" sizes="25vw" showPlaceholderNote={false} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          {s.summary ? <p className="text-lead text-fg-muted">{s.summary}</p> : null}

          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {duration ? (
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-fg-muted" aria-hidden="true" /> {duration}
              </li>
            ) : null}
            {s.maxParticipants ? (
              <li className="flex items-center gap-2">
                <Users className="size-4 text-fg-muted" aria-hidden="true" /> Up to {s.maxParticipants} people
                {s.minAge ? ` · age ${s.minAge}+` : ""}
              </li>
            ) : null}
            {s.languages.length ? (
              <li className="flex items-center gap-2">
                <Languages className="size-4 text-fg-muted" aria-hidden="true" /> {s.languages.join(", ")}
              </li>
            ) : null}
            {s.requiresLicence ? (
              <li className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-fg-muted" aria-hidden="true" /> Valid driving licence required at pickup
              </li>
            ) : null}
          </ul>

          {s.weatherDependent ? (
            <p className="flex items-start gap-2 rounded-lg border border-info/40 bg-info/5 p-3 text-sm">
              <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Weather-dependent: the operator may pause departures for safety. Cancellations for weather are refunded in full.
            </p>
          ) : null}

          {s.highlights.length ? (
            <Section title="Highlights">
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {s.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> {h}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {s.description ? (
            <Section title="About">
              <p className="max-w-prose leading-relaxed text-fg-muted">{s.description}</p>
            </Section>
          ) : null}

          {s.inclusions.length || s.exclusions.length ? (
            <Section title="What's included">
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <ul className="flex flex-col gap-1.5">
                  {s.inclusions.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> {x}
                    </li>
                  ))}
                </ul>
                <ul className="flex flex-col gap-1.5 text-fg-muted">
                  {s.exclusions.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          ) : null}

          {s.safetyInfo ? (
            <Section title="Safety">
              <p className="max-w-prose text-sm text-fg-muted">{s.safetyInfo}</p>
            </Section>
          ) : null}

          {s.locations.length ? (
            <Section title="Where to go">
              <ul className="flex flex-col gap-3 text-sm">
                {s.locations.map((l) => (
                  <li key={`${l.kind}-${l.name}`} className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{LOCATION_LABEL[l.kind] ?? "Location"}:</span> {l.name}
                      {l.addressLine ? <span className="block text-fg-muted">{l.addressLine}</span> : null}
                      {l.instructions ? <span className="block text-fg-muted">{l.instructions}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Your partner">
            <div className="flex flex-col gap-1 text-sm">
              <p className="flex items-center gap-1.5 font-semibold">
                {s.provider.name}
                {s.provider.verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck className="size-4" aria-hidden="true" /> Verified partner
                  </span>
                ) : null}
              </p>
              {s.provider.verifiedSince ? <p className="text-xs text-fg-muted">Documents verified since {fmtDate(s.provider.verifiedSince, { weekday: undefined })}</p> : null}
              {s.provider.description ? <p className="max-w-prose text-fg-muted">{s.provider.description}</p> : null}
              <p className="text-xs text-fg-muted">Verification checks the documents a partner submits; it is not a certification of legal compliance.</p>
            </div>
          </Section>

          {s.cancellationPolicy ? (
            <Section title="Cancellation policy">
              <p className="text-sm">
                <span className="font-semibold">{s.cancellationPolicy.name}.</span> <span className="text-fg-muted">{s.cancellationPolicy.summary}</span>
              </p>
              <p className="text-xs text-fg-muted">If the partner cancels (including for weather), you get a full refund.</p>
            </Section>
          ) : null}

          <Section title={`Reviews${s.rating.count ? ` (${s.rating.count})` : ""}`}>
            {s.reviews.length === 0 ? (
              <p className="text-sm text-fg-muted">No reviews yet. Only travellers who completed a booking can review.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {s.reviews.map((r, i) => (
                  <li key={i} className="flex flex-col gap-1 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="inline-flex" aria-label={`${r.rating} out of 5`}>
                        {Array.from({ length: 5 }, (_, k) => (
                          <Star key={k} className={k < r.rating ? "size-4 fill-butter text-butter-deep" : "size-4 text-line-strong"} aria-hidden="true" />
                        ))}
                      </span>
                      <span className="font-semibold">{r.title}</span>
                    </p>
                    {r.body ? <p className="text-fg-muted">{r.body}</p> : null}
                    <p className="text-xs text-fg-muted">
                      {r.author} · {fmtDate(r.createdAt, { weekday: undefined })}
                    </p>
                    {r.response ? (
                      <p className="mt-1 rounded-md bg-surface-sunken p-2 text-xs">
                        <span className="font-semibold">Response from {s.provider.name}: </span>
                        {r.response}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="lg:col-span-5 lg:col-start-8" aria-label="Book">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
            <BookingPanel service={s} />
          </div>
        </aside>
      </div>
    </div>
  );
}
