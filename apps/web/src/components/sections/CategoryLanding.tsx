import Link from "next/link";
import type { Metadata } from "next";
import { getShelf, type CategoryShelf } from "@/config/categories";
import { shelfSeo } from "@/config/seo";
import { breadcrumbJsonLd, pageOpenGraph, shareImage } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { destinations } from "@/content/destinations";
import { MediaFrame } from "@/components/media/MediaFrame";
import { TextReveal } from "@/components/motion/TextReveal";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { SearchBar } from "@/components/ui/SearchBar";
import { LiveInventory } from "./LiveInventory";

/** One landing template for every service shelf (stays, boating, rentals, …), driven by config. */
export function CategoryLanding({ slug }: { slug: CategoryShelf["slug"] }) {
  const shelf = getShelf(slug);
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: shelf.label, path: shelf.href },
        ])}
      />
      <section aria-labelledby="category-title" className="container-editorial grid gap-10 py-10 lg:grid-cols-12 lg:py-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: shelf.label }]} />
          <TextReveal id="category-title" as="h1" text={shelf.label} className="font-display text-display-xl" />
          <p className="max-w-2xl text-lead text-fg-muted">{shelf.intro}</p>
          <ul className="flex flex-wrap gap-2" aria-label="What you choose when booking">
            {shelf.searchHints.map((hint) => (
              <li key={hint} className="rounded-full border border-line-strong px-3 py-1 text-sm">
                {hint}
              </li>
            ))}
          </ul>
        </div>
        <MediaFrame src={shelf.image} alt={`${shelf.label} on the Karnataka coast`} scene={shelf.scene} aspect="aspect-[4/3]" className="rounded-2xl lg:col-span-5" />
      </section>

      <div className="container-editorial">
        <SearchBar destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))} initial={{ shelf: shelf.slug }} variant="inline" />
      </div>

      <section aria-labelledby="by-destination" className="container-editorial flex flex-col gap-12 py-12 lg:py-16">
        <h2 id="by-destination" className="sr-only">
          {shelf.label} by destination
        </h2>
        {destinations.map((d) => (
          <div key={d.slug} className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h3 className="font-display text-display-sm">
                {shelf.label} in {d.name}
              </h3>
              <Link href={`/destinations/${d.slug}`} className="text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
                About {d.name}
              </Link>
            </div>
            <LiveInventory
              destination={d.slug}
              categories={shelf.categories}
              emptyTitle={`No ${shelf.label.toLowerCase()} listed in ${d.name} yet`}
              emptyDescription={shelf.emptyMessage}
            />
          </div>
        ))}
      </section>
    </>
  );
}

export function categoryMetadata(slug: CategoryShelf["slug"]): Metadata {
  const shelf = getShelf(slug);
  const seo = shelfSeo[slug];
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: shelf.href },
    openGraph: pageOpenGraph({ url: shelf.href, title: seo.title, description: seo.description, images: shareImage(shelf.image, `${shelf.label} on the Karnataka coast`) }),
  };
}
