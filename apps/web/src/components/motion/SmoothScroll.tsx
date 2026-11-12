"use client";

import { useEffect } from "react";
import { useMotionPrefs } from "./useMotionPrefs";

/** The running Lenis instance while smooth scrolling is on, so other code can scroll through it. */
let activeLenis: { scrollTo: (target: number) => void } | null = null;

/** Scrolls the page to the top: through Lenis when it is running, with the browser's own scroll otherwise. */
export function scrollToTop() {
  if (activeLenis) {
    activeLenis.scrollTo(0);
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/**
 * Lenis smooth scrolling for the public editorial site only (mounted in the (public)
 * layout, never in traveller/partner/admin shells). Desktop + fine pointer + motion allowed.
 * Lenis drives native window scroll, so keyboard, find-in-page and anchors keep working.
 */
export function SmoothScroll() {
  const { richMotion } = useMotionPrefs();

  useEffect(() => {
    if (!richMotion) return;
    let destroy: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, autoRaf: true });
      lenis.on("scroll", ScrollTrigger.update);
      activeLenis = lenis;
      destroy = () => {
        if (activeLenis === lenis) activeLenis = null;
        lenis.destroy();
      };
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [richMotion]);

  return null;
}
