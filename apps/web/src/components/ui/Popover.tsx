"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes, type RefObject } from "react";
import { cn } from "@/lib/cn";

/** Space between the anchor and the panel, and between the panel and the screen edge (px). */
const GAP = 6;
const EDGE = 8;

/**
 * Keeps a floating panel (dropdown list, calendar) next to the control that opened it.
 *
 * The panel is shown with the Popover API, so it sits in the browser's top layer: it is
 * never cut off by a scrolling parent, a sticky panel or a <dialog>, and still belongs to
 * the same place in the page for keyboard and screen-reader order. Where the Popover API
 * is missing the panel simply renders as a fixed box.
 *
 * It opens below the anchor, or above when there is more room there, and follows the
 * anchor while the page scrolls or resizes. A press outside closes it.
 */
export function useAnchoredPanel<A extends HTMLElement>({
  open,
  onClose,
  maxHeight,
}: {
  open: boolean;
  onClose: () => void;
  /** Tallest the panel may get, in px. The panel scrolls inside when its content is taller. */
  maxHeight?: number;
}) {
  const anchorRef = useRef<A>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const viewH = window.innerHeight;

    // Full height of the content, whatever max-height is on the panel right now.
    const natural = panel.scrollHeight + (panel.offsetHeight - panel.clientHeight);
    const wanted = Math.min(natural, maxHeight ?? natural);
    const below = viewH - a.bottom - GAP - EDGE;
    const above = a.top - GAP - EDGE;
    const openUp = wanted > below && above > below;
    const room = Math.max(openUp ? above : below, 160);
    const height = Math.min(wanted, room);
    const top = openUp ? a.top - GAP - height : a.bottom + GAP;

    const width = Math.max(panel.offsetWidth, a.width);
    const left = Math.max(EDGE, Math.min(a.left, viewW - EDGE - width));

    panel.style.top = `${Math.round(Math.max(EDGE, Math.min(top, viewH - EDGE - height)))}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.minWidth = `${Math.round(Math.min(a.width, viewW - EDGE * 2))}px`;
    panel.style.maxHeight = `${Math.round(Math.min(room, maxHeight ?? room))}px`;
  }, [maxHeight]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (panel && typeof panel.showPopover === "function") {
      try {
        panel.showPopover();
      } catch {
        // Already showing.
      }
    }
    place();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (panel) observer?.observe(panel);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, place]);

  return { anchorRef, panelRef };
}

/** The floating surface itself. Render it only while open, inside the anchor element. */
export function PopoverPanel({ ref, className, ...props }: HTMLAttributes<HTMLDivElement> & { ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={ref}
      popover="manual"
      data-lenis-prevent=""
      className={cn(
        "fixed inset-auto z-50 m-0 overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface-raised p-0 text-left text-fg shadow-lift motion-safe:animate-pop-in",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Look for a control that carries its own small label inside (the search bar segments).
 * The button's ::after covers the whole box, so a press anywhere in the box opens it.
 */
export const insetWrapClasses =
  "relative flex min-w-0 flex-1 flex-col gap-0.5 px-5 py-3 text-left transition-colors duration-150 hover:bg-fg/5 " +
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-accent-text";
export const insetLabelClasses = "text-xs font-semibold text-fg-muted";
export const insetButtonClasses =
  "flex min-w-0 items-center gap-1.5 text-left text-[0.9375rem] font-semibold text-fg outline-none " +
  "after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] disabled:cursor-not-allowed disabled:opacity-60";
