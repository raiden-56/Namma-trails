"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useMotionPrefs } from "./useMotionPrefs";

/**
 * Layered card stack.
 * - ≥ lg: cards are `position: sticky` with staggered offsets, so each new card slides
 *   over the previous one as you scroll (works without JS). With rich motion enabled,
 *   GSAP additionally scales/dims the covered cards for depth.
 * - < lg (and touch): a horizontal scroll-snap rail — no pinning on mobile.
 * Scrolling is never trapped: the section is just tall content.
 */
export function PinnedStack({ items, label, className }: { items: Array<{ id: string; node: ReactNode }>; label: string; className?: string }) {
  const root = useRef<HTMLUListElement>(null);
  const { richMotion } = useMotionPrefs();

  useEffect(() => {
    if (!richMotion || !root.current) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          gsap.to(card.firstElementChild, {
            scale: 0.92,
            opacity: 0.55,
            ease: "none",
            scrollTrigger: { trigger: next, start: "top bottom", end: "top 20%", scrub: true },
          });
        });
      }, root);
      revert = () => ctx.revert();
    })();
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [richMotion]);

  return (
    <ul
      ref={root}
      aria-label={label}
      className={cn(
        "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2",
        "lg:mx-0 lg:block lg:snap-none lg:overflow-visible lg:px-0 lg:pb-0",
        className,
      )}
    >
      {items.map((item, i) => (
        <li
          key={item.id}
          data-stack-card
          className="w-[82vw] max-w-sm shrink-0 snap-center lg:sticky lg:mb-[12vh] lg:w-full lg:max-w-none"
          style={{ top: `calc(var(--header-h) + 2rem + ${i * 1.5}rem)` }}
        >
          <div className="origin-top transition-none">{item.node}</div>
        </li>
      ))}
    </ul>
  );
}
