import Image from "next/image";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { brand } from "@/config/brand";
import { destinations, destinationsNorthToSouth } from "@/content/destinations";
import { photo } from "@/content/photos";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { TextReveal } from "@/components/motion/TextReveal";
import { SearchBar } from "@/components/ui/SearchBar";

/**
 * Hero as one scene: a bright photograph of the Gokarna coast (blue sky, green headland,
 * turquoise bay) fills a rounded frame, the headline sits on its left side (darkened only
 * there, so the picture keeps its colour), and the unified search rises over the bottom edge. The frame is
 * sized to the first screen (viewport − header − half the search bar), so the search is
 * always reachable without scrolling and is never behind animation.
 */
export function Hero() {
  const scene = photo("gokarna-headland-blue-sky");
  const stops = destinationsNorthToSouth();

  return (
    <section aria-labelledby="hero-title" className="px-2 pt-2 sm:px-4 lg:px-6">
      <div className="theme-ink relative isolate flex min-h-[min(calc(100svh-var(--header-h)-4rem),42rem)] lg:min-h-[min(calc(100svh-var(--header-h)-4rem),56rem)] flex-col overflow-hidden rounded-xl sm:rounded-2xl">
        <ParallaxImage className="absolute inset-0 -z-20" strength={8} scale={1.08}>
          <Image
            src={scene.src}
            alt={scene.alt}
            fill
            priority
            sizes="100vw"
            className="animate-[hero-settle_2.4s_var(--ease-editorial)_both] object-cover object-[50%_50%] lg:object-[50%_58%]"
          />
        </ParallaxImage>
        <div aria-hidden="true" className="hero-scrim absolute inset-0 -z-10" />

        {/* Below lg the text sits low, next to the search, so the bay stays clear above it. */}
        <div className="container-editorial flex flex-1 flex-col justify-end gap-5 pb-6 pt-24 sm:pb-8 lg:justify-center lg:py-12">
          <p className="text-[0.8125rem] font-semibold text-cream/85">Coastal Karnataka · four towns to start</p>
          <TextReveal
            id="hero-title"
            as="h1"
            text="Your whole coast trip, booked in one place."
            className="max-w-[15ch] font-display text-hero text-cream"
          />
          <p className="max-w-xl text-lead text-cream/90">{brand.description}</p>
          <div>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 border-b border-cream/50 pb-1 text-[0.9375rem] font-semibold text-cream transition-colors hover:border-cream"
            >
              See how it works
              <ArrowDown className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* The coast as a trail: the four launch towns, north to south. */}
        <div className="container-editorial hidden items-end justify-between gap-8 pb-16 sm:flex">
          <nav aria-label="Launch towns, north to south">
            <ol className="flex items-center">
              {stops.map((d, i) => (
                <li key={d.slug} className="flex items-center">
                  {i > 0 ? <span aria-hidden="true" className="mx-3 w-8 border-t border-dashed border-cream/60 lg:w-14" /> : null}
                  <Link
                    href={`/destinations/${d.slug}`}
                    className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-cream underline-offset-4 hover:underline"
                  >
                    <span aria-hidden="true" className="size-2 rounded-full bg-tomato ring-2 ring-cream/80" />
                    {d.name}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <p className="hidden font-script text-2xl leading-none text-cream lg:block">Gokarna, Karnataka</p>
        </div>
        <div aria-hidden="true" className="h-12 sm:hidden" />
      </div>

      <div data-hero-search className="container-editorial relative z-20 -mt-8 lg:-mt-[2.375rem]">
        <SearchBar destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))} variant="hero" />
      </div>
    </section>
  );
}
