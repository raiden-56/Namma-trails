import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BlogPost } from "@/content/blog";
import { photo } from "@/content/photos";
import { MediaFrame } from "@/components/media/MediaFrame";
import { cn } from "@/lib/cn";

/** Tag and one-line detail shown above a blog title. */
export function BlogMeta({ post, className }: { post: BlogPost; className?: string }) {
  return (
    <p className={cn("text-[0.8125rem] font-semibold text-accent-text", className)}>
      {post.tag}
      <span className="font-normal text-fg-muted"> · {post.detail}</span>
    </p>
  );
}

/**
 * Blog article card. Whole-card link pattern (one focusable link stretched over the
 * card), same as DestinationCard. `size="lg"` is the wide feature card on the homepage.
 */
export function BlogCard({ post, size = "md", className }: { post: BlogPost; size?: "md" | "lg"; className?: string }) {
  const image = photo(post.image);
  return (
    <article className={cn("group relative flex h-full flex-col overflow-hidden rounded-xl bg-surface-raised shadow-card", className)}>
      <MediaFrame
        src={image.src}
        alt={image.alt}
        aspect={size === "lg" ? "aspect-[3/2] lg:aspect-[16/10]" : "aspect-[3/2]"}
        sizes={size === "lg" ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 640px) 50vw, 100vw"}
        mediaClassName="transition-transform duration-700 ease-(--ease-editorial) group-hover:scale-[1.04]"
      />
      <div className={cn("flex flex-1 flex-col gap-2", size === "lg" ? "p-6 lg:p-8" : "p-5")}>
        <BlogMeta post={post} />
        <h3 className={cn("font-display leading-tight", size === "lg" ? "text-display-md" : "text-display-sm")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </h3>
        <p className="text-[0.9375rem] leading-relaxed text-fg-muted">{post.summary}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-accent-text" aria-hidden="true">
          Read the article
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl ring-accent-text group-has-focus-visible:ring-2" />
    </article>
  );
}

/** Compact row: thumbnail, tag and title. Used for the list beside the feature card. */
export function BlogRow({ post }: { post: BlogPost }) {
  const image = photo(post.image);
  return (
    <article className="group relative flex items-center gap-4 py-5">
      <MediaFrame src={image.src} alt="" aspect="aspect-square" sizes="112px" className="w-24 shrink-0 rounded-lg sm:w-28" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <BlogMeta post={post} />
        <h3 className="font-display text-xl leading-snug transition-colors duration-200 group-hover:text-accent-text">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4">
            {post.title}
          </Link>
        </h3>
      </div>
      <ArrowUpRight
        aria-hidden="true"
        className="size-5 shrink-0 text-fg-muted transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-text"
      />
    </article>
  );
}
