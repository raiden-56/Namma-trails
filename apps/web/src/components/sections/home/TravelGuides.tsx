import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { destinations } from "@/content/destinations";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "../SectionHeading";

/** Travel information and destination guides (editorial CMS content). */
export function TravelGuides() {
  return (
    <section aria-labelledby="guides-title" className="py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-12">
        <SectionHeading
          eyebrow="Travel information"
          title={<span id="guides-title">Know before you go</span>}
          intro="Practical notes for each launch destination — seasons, temple etiquette and safety on the water."
        />
        <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2">
          {destinations.map((d, i) => (
            <Reveal as="li" key={d.slug} delay={i * 0.05} className="flex flex-col gap-4 border-t border-line-strong pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-display-sm">{d.name}</h3>
                <Link href={`/destinations/${d.slug}#travel-tips`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
                  Full guide <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <p className="text-fg-muted">{d.overview[0]}</p>
              <p className="border-l-2 border-accent pl-4 text-sm">{d.travelTips[d.travelTips.length - 1]}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
