import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryShelves } from "@/config/categories";
import { destinationKeywords } from "@/config/seo";
import { blogPosts } from "@/content/blog";
import { destinations, getDestination } from "@/content/destinations";
import { env } from "@/lib/env";
import { breadcrumbJsonLd, faqJsonLd, pageOpenGraph, shareImage } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { BlogRow } from "@/components/sections/blog/BlogCard";
import { MapView } from "@/components/map/MapView";
import { MediaFrame } from "@/components/media/MediaFrame";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { TextReveal } from "@/components/motion/TextReveal";
import { LiveInventory } from "@/components/sections/LiveInventory";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { StatusChip } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { EmptyState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDestination(slug);
  if (!d) return {};
  return {
    title: d.seo.title,
    description: d.seo.description,
    keywords: destinationKeywords[d.slug],
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: pageOpenGraph({
      url: `/destinations/${d.slug}`,
      title: d.seo.title,
      description: d.seo.description,
      images: d.image ? shareImage(d.image, `${d.name}, ${d.district}`) : undefined,
    }),
  };
}

export default async function DestinationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const d = getDestination(slug);
  if (!d) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: d.name,
    description: d.summary,
    url: `${env.siteUrl}/destinations/${d.slug}`,
    containedInPlace: { "@type": "AdministrativeArea", name: `${d.district}, ${d.state}` },
    includesAttraction: d.attractions.map((a) => ({ "@type": "TouristAttraction", name: a.name, description: a.description })),
  };

  const plans = blogPosts.filter((post) => post.destinations.includes(d.slug));

  return (
    <>
      <JsonLd
        data={[
          jsonLd,
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Destinations", path: "/destinations" },
            { name: d.name, path: `/destinations/${d.slug}` },
          ]),
          ...(d.faqs.length > 0 ? [faqJsonLd(d.faqs)] : []),
        ]}
      />

      {/* Hero */}
      <section aria-labelledby="dest-title" className="relative">
        <ParallaxImage className="h-[46vh] min-h-[20rem] lg:h-[60vh]">
          <MediaFrame src={d.image} alt={`${d.name}, ${d.district}`} scene={d.scene} className="absolute inset-0" priority />
        </ParallaxImage>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" aria-hidden="true" />
        <div className="container-editorial absolute inset-x-0 bottom-0 flex flex-col gap-4 pb-10 text-cream lg:pb-12">
          <Breadcrumbs
            className="[&_a]:text-cream/85 [&_li]:text-cream/85 [&_span[aria-current]]:text-cream"
            items={[{ label: "Home", href: "/" }, { label: "Destinations", href: "/destinations" }, { label: d.name }]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-cream/85">{d.district}, {d.state}</span>
            <StatusChip kind="destination" status={d.status} className="bg-ivory text-ink" />
          </div>
          <TextReveal id="dest-title" as="h1" text={d.name} className="font-display text-display-2xl" />
          <p className="max-w-2xl text-lead text-cream/90">{d.headline}</p>
        </div>
      </section>

      {/* Overview + attractions */}
      <section aria-labelledby="overview" className="py-12 lg:py-16">
        <div className="container-editorial grid gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-5">
            <p className="eyebrow">Overview</p>
            <h2 id="overview" className="font-display text-display-md">About {d.name}</h2>
            {d.overview.map((p) => (
              <p key={p.slice(0, 24)} className="text-lead text-fg-muted">
                {p}
              </p>
            ))}
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <h3 className="mb-4 text-sm font-semibold text-fg-muted">Places to visit in {d.name}</h3>
            <ul className="divide-y divide-line border-y border-line">
              {d.attractions.map((a, i) => (
                <li key={a.name} className="grid grid-cols-[2.5rem_1fr] gap-3 py-5">
                  <span className="font-display text-xl text-accent-text">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-lg font-semibold">{a.name}</p>
                    <p className="text-fg-muted">{a.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bookable services by category — live inventory only */}
      <section aria-labelledby="book-title" className="bg-surface-sunken py-12 lg:py-16">
        <div className="container-editorial flex flex-col gap-8">
          <SectionHeading
            eyebrow="Book in this destination"
            title={<span id="book-title">Stays, boats, rentals and more in {d.name}</span>}
            intro="Everything listed here comes from verified local partners. Empty categories mean no partner has been approved for them yet."
          />
          <Tabs
            label={`Services in ${d.name}`}
            variant="pill"
            items={categoryShelves.map((shelf) => ({
              id: shelf.slug,
              label: shelf.label,
              content: (
                <LiveInventory
                  destination={d.slug}
                  categories={shelf.categories}
                  emptyTitle={`No ${shelf.label.toLowerCase()} in ${d.name} yet`}
                  emptyDescription={shelf.emptyMessage}
                />
              ),
            }))}
          />
        </div>
      </section>

      {/* Map + itineraries */}
      <section aria-labelledby="plan-title" className="py-12 lg:py-16">
        <div className="container-editorial grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h2 id="plan-title" className="font-display text-display-md">On the map</h2>
            <MapView title={`Places in ${d.name}`} markers={d.attractions.map((a) => ({ id: a.name, label: a.name, kind: "attraction" }))} />
          </div>
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-display-md">Trip plans for {d.name}</h2>
            {plans.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line-strong border-y border-line-strong">
                {plans.map((post) => (
                  <li key={post.slug}>
                    <BlogRow post={post} />
                  </li>
                ))}
              </ul>
            ) : (
            <EmptyState
              title="Itineraries are being written"
              description={`Our editors publish ${d.name} itineraries once there are verified stays, transport and activities to link them to.`}
              action={
                <Button href={`/explore?destination=${d.slug}`} variant="secondary" size="sm">
                  Search {d.name}
                </Button>
              }
            />
            )}
          </div>
        </div>
      </section>

      {/* Travel tips + FAQs */}
      <section aria-labelledby="travel-tips" className="theme-ink py-12 lg:py-16">
        <div className="container-editorial grid gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <p className="eyebrow">Travel tips</p>
            <h2 id="travel-tips" className="font-display text-display-md">Before you go</h2>
            <ul className="flex flex-col gap-4">
              {d.travelTips.map((tip) => (
                <li key={tip.slice(0, 32)} className="border-l-2 border-tomato pl-4 text-fg-muted">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-6">
            <p className="eyebrow">FAQs</p>
            <h2 className="font-display text-display-md">Common questions</h2>
            <div className="divide-y divide-line border-y border-line">
              {d.faqs.map((f) => (
                <details key={f.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <span aria-hidden="true" className="text-2xl text-tomato transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="pt-3 text-fg-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
