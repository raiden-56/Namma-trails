import type { Metadata } from "next";
import { blogPosts } from "@/content/blog";
import { absoluteUrl, breadcrumbJsonLd, pageOpenGraph, photoShareImage } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Reveal } from "@/components/motion/Reveal";
import { BlogCard } from "@/components/sections/blog/BlogCard";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Breadcrumbs } from "@/components/ui/Navigation";

export const metadata: Metadata = {
  title: "Coastal Karnataka travel blog: itineraries and places to visit",
  description: "Trip plans for coastal Karnataka: a Gokarna 1-day itinerary, a 7-day Karwar to Udupi road trip, places to visit and Uttara Kannada itineraries.",
  keywords: ["coastal Karnataka travel blog", "Gokarna itinerary", "coastal Karnataka itinerary", "Uttara Kannada tourist places", "places to visit in coastal Karnataka", "Karnataka coast trip plan"],
  alternates: { canonical: "/blog" },
  openGraph: pageOpenGraph({ url: "/blog", images: photoShareImage("gokarna-om-beach") }),
};

export default function BlogIndexPage() {
  return (
    <div className="container-editorial flex flex-col gap-12 py-12 lg:py-16">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: blogPosts.map((post, i) => ({ "@type": "ListItem", position: i + 1, name: post.title, url: absoluteUrl(`/blog/${post.slug}`) })),
          },
        ]}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
      <SectionHeading
        as="h1"
        eyebrow="Blog"
        title="Trip plans and sightseeing notes"
        intro="Simple plans you can follow, written for the four launch towns and the country around them. No prices and no promises about what is open: check each listing for that."
      />
      <ul className="grid gap-6 sm:grid-cols-2 lg:gap-8">
        {blogPosts.map((post, i) => (
          <Reveal as="li" key={post.slug} delay={(i % 2) * 0.06}>
            <BlogCard post={post} />
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
