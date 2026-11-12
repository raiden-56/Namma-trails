"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  count?: number;
}

/** WAI-ARIA tabs with roving tabindex (Arrow keys, Home, End). Activation follows focus. */
export function Tabs({
  items,
  defaultTab,
  label,
  className,
  listClassName,
  variant = "underline",
}: {
  items: TabItem[];
  defaultTab?: string;
  label: string;
  className?: string;
  /** Extra classes for the tab list, e.g. "w-fit" so a pill control hugs its tabs. */
  listClassName?: string;
  variant?: "underline" | "pill";
}) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    const item = items[next];
    if (!item) return;
    setActive(item.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "no-scrollbar flex gap-1 overflow-x-auto",
          variant === "underline" ? "border-b border-line" : "rounded-full bg-surface-sunken p-1",
          listClassName,
        )}
      >
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors",
                variant === "underline"
                  ? cn("-mb-px border-b-2 px-3 py-3", selected ? "border-accent-text text-fg" : "border-transparent text-fg-muted hover:text-fg")
                  : cn("rounded-full px-4 py-2", selected ? "bg-surface-raised text-fg shadow-card" : "text-fg-muted hover:text-fg"),
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="rounded-full bg-fg/8 px-2 py-0.5 text-xs tabular-nums">{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="pt-6 focus-visible:outline-offset-4"
        >
          {item.id === active ? item.content : null}
        </div>
      ))}
    </div>
  );
}
