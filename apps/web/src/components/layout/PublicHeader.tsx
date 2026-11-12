"use client";

import { AccountButton } from "@/features/auth/session";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { publicEditorialNav, publicNav, publicUtilityNav } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "./Wordmark";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const underline =
  "after:absolute after:inset-x-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300 hover:after:scale-x-100 aria-[current=page]:after:scale-x-100";

/**
 * Every destination, category and editorial link, in the order the header shows them.
 */
const mainLinks = [...publicNav, ...publicEditorialNav];

/**
 * Links for the swipe row. "Become a Partner" joins the row only below md, where the
 * top bar has no room for its button; "My Trips" is always in the row.
 */
const railLinks = [
  ...mainLinks.map((item) => ({ ...item, hideFrom: "" })),
  ...publicUtilityNav.map((item) => ({ ...item, hideFrom: item.href === "/trips" ? "" : "md:hidden" })),
];

/**
 * Public header.
 * - ≥ xl: one bar with every destination and category link visible at once.
 * - < xl: a compact bar (wordmark + account) with the same links in a single row
 *   underneath that you swipe sideways. The current page stays scrolled into view.
 * The total height is published as --header-h in globals.css for sticky offsets.
 */
export function PublicHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const rail = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const list = rail.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollLeft += offset - (list.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300",
        scrolled ? "border-line bg-surface/90 backdrop-blur-md" : "border-transparent bg-surface",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-surface">
        Skip to content
      </a>
      <div className="container-editorial flex h-16 items-center justify-between gap-6">
        <Wordmark />

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-4 whitespace-nowrap text-sm font-semibold 2xl:gap-6">
            {mainLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={cn("relative py-2 text-fg/80 transition-colors hover:text-fg aria-[current=page]:text-fg after:-bottom-0.5", underline)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/trips" className="hidden px-2 text-sm font-semibold text-fg/80 hover:text-fg 2xl:inline">
            My Trips
          </Link>
          <Button href="/partner/join" variant="secondary" size="sm" className="hidden md:inline-flex">
            Become a Partner
          </Button>
          <AccountButton />
        </div>
      </div>

      {/* < xl: every link in one row; swipe sideways for the rest. */}
      <nav aria-label="Browse" className="container-editorial h-11 border-t border-line xl:hidden">
        <ul
          ref={rail}
          className="no-scrollbar -mx-3 flex h-full items-stretch overflow-x-auto text-sm font-semibold [mask-image:linear-gradient(90deg,transparent,#000_0.75rem,#000_calc(100%-2.5rem),transparent)]"
        >
          {railLinks.map((item) => (
            <li key={item.href} className={cn("shrink-0", item.hideFrom)}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-full items-center whitespace-nowrap px-3 text-fg/75 -outline-offset-2 transition-colors hover:text-fg aria-[current=page]:text-fg after:inset-x-3 after:bottom-0",
                  underline,
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li aria-hidden="true" className="w-8 shrink-0" />
        </ul>
      </nav>
    </header>
  );
}
