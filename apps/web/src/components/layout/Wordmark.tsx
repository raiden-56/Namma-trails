import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

/** Typographic wordmark driven by brand config (swap for an SVG logo once the identity is final). */
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-baseline gap-1 font-display text-2xl leading-none tracking-tight", className)} aria-label={`${brand.name} — home`}>
      <span>{brand.wordmark.primary}</span>
      <span className="italic text-accent-text">{brand.wordmark.secondary}</span>
    </Link>
  );
}
