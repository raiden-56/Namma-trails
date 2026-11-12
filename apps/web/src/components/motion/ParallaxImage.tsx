"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useMotionPrefs } from "./useMotionPrefs";

/**
 * Scroll-linked parallax for large photography blocks (GSAP ScrollTrigger, scrubbed).
 * Desktop + fine pointer + motion allowed only; otherwise renders static.
 * GSAP is loaded lazily so it never ships in the critical path.
 */
export function ParallaxImage({
  children,
  className,
  strength = 12,
  scale = 1.12,
}: {
  children: ReactNode;
  className?: string;
  /** Vertical travel in percent of the layer height. */
  strength?: number;
  scale?: number;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const { richMotion } = useMotionPrefs();

  useEffect(() => {
    if (!richMotion || !outer.current || !inner.current) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.fromTo(
          inner.current,
          { yPercent: -strength / 2, scale },
          {
            yPercent: strength / 2,
            scale,
            ease: "none",
            scrollTrigger: { trigger: outer.current, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      }, outer);
      revert = () => ctx.revert();
    })();
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [richMotion, strength, scale]);

  return (
    <div ref={outer} className={cn("relative overflow-hidden", className)}>
      <div ref={inner} className="absolute inset-0 will-change-transform">
        {children}
      </div>
    </div>
  );
}
