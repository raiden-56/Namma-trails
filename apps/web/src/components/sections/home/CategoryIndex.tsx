"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { categoryShelves } from "@/config/categories";
import { cn } from "@/lib/cn";
import { SectionHeading } from "../SectionHeading";

/**
 * Explore by service category, set as an index: one row per shelf. On desktop the
 * row you point at (or focus) shows its photograph and what you choose when you
 * search it; on smaller screens each row carries its own thumbnail instead.
 */
export function CategoryIndex() {
  const [active, setActive] = useState(0);
  const current = categoryShelves[active] ?? categoryShelves[0]!;

  return (
    <section aria-labelledby="categories-title" className="py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-10 lg:gap-14">
        <SectionHeading
          eyebrow="One platform, every part of the trip"
          title={<span id="categories-title">Explore by what you need</span>}
          intro="Stays, boats, two-wheelers, cabs, guides and experiences sit side by side, so you can plan the whole trip without juggling phone numbers."
        />

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <ul className="lg:col-span-7">
            {categoryShelves.map((shelf, i) => (
              <li
                key={shelf.slug}
                className="group border-t border-line-strong last:border-b"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
              >
                <Link href={shelf.href} className="flex items-center gap-4 py-4 -outline-offset-2 lg:gap-6 lg:py-5">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-sand lg:hidden">
                    <Image src={shelf.image} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                  <span aria-hidden="true" className="hidden w-8 shrink-0 text-sm tabular-nums text-fg-muted lg:block">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-6">
                    <span
                      className={cn(
                        "font-display text-display-md transition-colors duration-200 group-hover:text-accent-text",
                        i === active && "lg:text-accent-text",
                      )}
                    >
                      {shelf.label}
                    </span>
                    <span className="text-[0.9375rem] text-fg-muted">{shelf.blurb}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-fg-muted transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-text"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-[calc(var(--header-h)+2rem)] flex flex-col gap-4">
              <div aria-hidden="true" className="relative aspect-[4/5] max-h-[68vh] w-full overflow-hidden rounded-2xl bg-sand shadow-lift">
                {categoryShelves.map((shelf, i) => (
                  <Image
                    key={shelf.slug}
                    src={shelf.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 36vw, 1px"
                    className={cn("object-cover transition-opacity duration-500 ease-(--ease-editorial)", i === active ? "opacity-100" : "opacity-0")}
                  />
                ))}
              </div>
              <p className="text-[0.9375rem] text-fg-muted">
                <span className="font-semibold text-fg">{current.label}:</span> you choose {current.searchHints.join(", ").toLowerCase()}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
