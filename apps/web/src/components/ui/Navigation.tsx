import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Breadcrumbs({ items, className }: { items: Array<{ label: string; href?: string }>; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="underline-offset-4 hover:text-fg hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-fg")}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight aria-hidden="true" className="size-3.5" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Link-based pagination (works without JS, crawlable). */
export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "hover:bg-fg/8")} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="inline-flex items-center">
          {i > 0 && p - (pages[i - 1] ?? p) > 1 ? <span className="px-1 text-fg-muted">…</span> : null}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-fg text-surface" : "hover:bg-fg/8")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "hover:bg-fg/8")} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
