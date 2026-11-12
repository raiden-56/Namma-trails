import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { siteKeywords } from "@/config/seo";
import { pageOpenGraph, siteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { CategoryIndex } from "@/components/sections/home/CategoryIndex";
import { DestinationStack } from "@/components/sections/home/DestinationStack";
import { FeatureLedger } from "@/components/sections/home/FeatureLedger";
import { Hero } from "@/components/sections/home/Hero";
import { HowItWorks } from "@/components/sections/home/HowItWorks";
import { LiveShelves } from "@/components/sections/home/LiveShelves";
import { Manifesto } from "@/components/sections/home/Manifesto";
import { PartnerCta } from "@/components/sections/home/PartnerCta";
import { TravelBlog } from "@/components/sections/home/TravelBlog";
import { TravelGuides } from "@/components/sections/home/TravelGuides";
import { WhyBook } from "@/components/sections/home/WhyBook";

export const metadata: Metadata = {
  title: { absolute: `Gokarna, Murudeshwar, Karwar & Udupi trips | ${brand.name}` },
  description:
    "Plan and book a coastal Karnataka trip: verified stays, boat rides, scooty rentals, cabs, local guides and activities in Gokarna, Murudeshwar, Karwar and Udupi.",
  keywords: siteKeywords,
  alternates: { canonical: "/" },
  openGraph: pageOpenGraph({ url: "/" }),
};

/*
 * Homepage, in reading order:
 *  1 hero with the unified search · 2 what the product is, in one sentence ·
 *  3 how it works (traveller, partner and team flows) · 4 launch destinations ·
 *  5 trip plans from the blog · 6 service categories · 7 live listings by kind of service ·
 *  8 every feature, by who uses it · 9 why book with us · 10 become a partner ·
 *  11 travel guides · footer (layout)
 * Live listings (7) only ever show published, verified inventory from the search API.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <Hero />
      <Manifesto />
      <HowItWorks />
      <DestinationStack />
      <TravelBlog />
      <CategoryIndex />
      <LiveShelves />
      <FeatureLedger />
      <WhyBook />
      <PartnerCta />
      <TravelGuides />
    </>
  );
}
