import { createElement, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Word-by-word headline reveal. Pure CSS (no JS needed, runs before hydration):
 * each word sits in an overflow-hidden mask sized by the word itself, so there is no
 * layout shift. Screen readers get the plain sentence; the split words are aria-hidden.
 * Reduced motion is handled globally in globals.css (animation collapses to its end state).
 */
export function TextReveal({
  text,
  as = "h1",
  className,
  stagger = 70,
  delay = 100,
  id,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  stagger?: number;
  delay?: number;
  id?: string;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return createElement(
    as,
    { className, id },
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span
              className={cn("inline-block animate-[word-rise_0.9s_var(--ease-editorial)_both]")}
              style={{ animationDelay: `${delay + i * stagger}ms` } as CSSProperties}
            >
              {word}
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </>,
  );
}
