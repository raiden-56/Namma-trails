"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { scrollToTop } from "@/components/motion/SmoothScroll";

/**
 * Round button in the bottom corner that takes the visitor back to the top of the page.
 * It stays out of the way (and out of the Tab order) until the page has been scrolled
 * most of a screen down.
 */
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setShown(window.scrollY > Math.max(480, window.innerHeight * 0.75));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      data-testid="back-to-top"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-4 right-4 z-40 mb-[env(safe-area-inset-bottom)] inline-flex size-12 items-center justify-center rounded-full border border-line-strong bg-surface-raised text-fg shadow-lift",
        "transition-[opacity,transform,visibility,background-color,color] duration-200 hover:border-fg hover:bg-fg hover:text-surface sm:bottom-6 sm:right-6",
        shown ? "visible opacity-100" : "invisible translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}
