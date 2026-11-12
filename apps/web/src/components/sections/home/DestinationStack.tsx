import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { destinations } from "@/content/destinations";
import { MediaFrame } from "@/components/media/MediaFrame";
import { PinnedStack } from "@/components/motion/PinnedStack";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/** Popular destinations as a layered, sticky card stack (scroll-snap rail on mobile). */
export function DestinationStack() {
  return (
    <section aria-labelledby="destinations-title" className="theme-ink py-16 lg:py-24">
      <div className="container-editorial grid gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-4 lg:self-start">
          <p className="eyebrow">Launch destinations</p>
          <h2 id="destinations-title" className="font-display text-display-lg">
            Four towns on the Konkan coast to start.
          </h2>
          <p className="text-lead text-fg-muted">
            We are opening destination by destination, as local partners are verified. Each town goes live once it has enough
            verified stays, boats, rentals and guides to plan a real trip.
          </p>
          <div>
            <Button href="/destinations" variant="primary" trailingIcon={<ArrowUpRight className="size-4" />}>
              All destinations
            </Button>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7 lg:col-start-6">
          <PinnedStack
            label="Launch destinations"
            items={destinations.map((d, i) => ({
              id: d.slug,
              node: (
                <article className="group relative grid overflow-hidden rounded-2xl bg-surface-raised lg:grid-cols-2">
                  <MediaFrame
                    src={d.image}
                    alt={`${d.name} — ${d.district}`}
                    scene={d.scene}
                    aspect="aspect-[4/3] lg:aspect-auto"
                    className="lg:min-h-[22rem]"
                    mediaClassName="transition-transform duration-700 ease-(--ease-editorial) group-hover:scale-[1.04]"
                  />
                  <div className="flex flex-col gap-4 p-6 lg:p-8">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-display-sm text-accent-text">0{i + 1}</span>
                      <StatusChip kind="destination" status={d.status} />
                    </div>
                    <h3 className="font-display text-display-md">
                      <Link href={`/destinations/${d.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                        {d.name}
                      </Link>
                    </h3>
                    <p className="text-fg-muted">{d.headline}</p>
                    <p className="text-sm text-fg-subtle">{d.district} district</p>
                    <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text">
                      Explore {d.name}
                      <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-accent-text group-has-focus-visible:ring-2" />
                </article>
              ),
            }))}
          />
        </div>
      </div>
    </section>
  );
}
