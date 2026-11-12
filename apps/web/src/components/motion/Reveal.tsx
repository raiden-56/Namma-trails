"use client";

import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Fades/slides content in when it scrolls into view (once).
 * Use for secondary content below the fold — never for primary CTAs or booking controls.
 *
 * Progressive enhancement: the server renders the content fully visible. After
 * hydration, content that is still below the fold is "armed" (hidden) and an
 * IntersectionObserver reveals it; the transition itself lives in globals.css
 * (`[data-reveal]`). Nothing is hidden without JavaScript, when the visitor
 * prefers reduced motion, or when the content is already on screen.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.dataset.reveal = "armed";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.dataset.reveal = "in";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      delete el.dataset.reveal;
    };
  }, []);

  return createElement(
    as,
    { ref, className, style: { "--reveal-delay": `${delay}s`, "--reveal-y": `${y}px` } as CSSProperties },
    children,
  );
}
