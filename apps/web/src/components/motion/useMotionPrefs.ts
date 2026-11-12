"use client";

import { useSyncExternalStore } from "react";

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

function useMedia(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/**
 * Motion capability flags. Rich scroll choreography (parallax, pinning, smooth scroll)
 * only runs when the user allows motion, uses a fine pointer, and has a desktop viewport.
 * Server render assumes the conservative path (no rich motion).
 */
export function useMotionPrefs() {
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)", true);
  const finePointer = useMedia("(hover: hover) and (pointer: fine)", false);
  const desktop = useMedia("(min-width: 1024px)", false);
  return { reducedMotion, finePointer, desktop, richMotion: !reducedMotion && finePointer && desktop };
}
