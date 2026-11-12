import type { Metadata } from "next";
import { destinations } from "@/content/destinations";
import { pageOpenGraph } from "@/lib/seo";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { DestinationCard } from "@/components/ui/Cards";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Coastal Karnataka destinations: Gokarna, Murudeshwar, Karwar, Udupi",
  description: "Places to visit on the Karnataka coast: Gokarna, Murudeshwar, Karwar and Udupi, each with a guide, places to see and verified stays, boats and rentals.",
  keywords: ["coastal Karnataka destinations", "places to visit in coastal Karnataka", "Gokarna", "Murudeshwar", "Karwar", "Udupi", "Uttara Kannada tourist places"],
  alternates: { canonical: "/destinations" },
  openGraph: pageOpenGraph({ url: "/destinations" }),
};

export default function DestinationsPage() {
  return (
    <div className="container-editorial flex flex-col gap-12 py-12 lg:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Destinations" }]} />
      <SectionHeading
        as="h1"
        eyebrow="Phase 1 · Coastal Karnataka"
        title="Where we are launching"
        intro="We open one destination at a time. A destination goes live when enough local partners have been verified to plan a complete trip there. Mangaluru, Kapu and inland Karnataka follow."
      />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {destinations.map((d, i) => (
          <Reveal as="li" key={d.slug} delay={i * 0.06}>
            <DestinationCard
              href={`/destinations/${d.slug}`}
              name={d.name}
              district={`${d.district}, ${d.state}`}
              summary={d.summary}
              image={d.image}
              scene={d.scene}
              status={d.status}
              size="lg"
              className="h-full"
            />
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
