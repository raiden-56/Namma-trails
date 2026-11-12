import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/config/brand";
import { getShelf } from "@/config/categories";
import { blogPosts, getBlogPost, type BlogPlan } from "@/content/blog";
import { getDestination } from "@/content/destinations";
import { photo } from "@/content/photos";
import { env } from "@/lib/env";
import { articleOpenGraph, breadcrumbJsonLd, faqJsonLd, photoShareImage } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { MediaFrame } from "@/components/media/MediaFrame";
import { TextReveal } from "@/components/motion/TextReveal";
import { BlogCard, BlogMeta } from "@/components/sections/blog/BlogCard";
import { Breadcrumbs } from "@/components/ui/Navigation";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.seo.title,
    description: post.seo.description,
    keywords: post.seo.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: articleOpenGraph({
      url: `/blog/${post.slug}`,
      title: post.seo.title,
      description: post.seo.description,
      images: photoShareImage(post.image),
      modifiedTime: post.updated,
    }),
  };
}

const updatedFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** A plan as a trail: each stop sits on a dotted line, with a link to its town guide. */
function Plan({ plan }: { plan: BlogPlan }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-display text-display-md">{plan.title}</h2>
      {plan.note ? <p className="border-l-2 border-accent pl-4 text-[0.9375rem] text-fg-muted">{plan.note}</p> : null}
      <ol className="relative flex flex-col gap-8 before:absolute before:bottom-3 before:left-[0.4375rem] before:top-3 before:-translate-x-1/2 before:border-l-[3px] before:border-dotted before:border-burnt/70">
        {plan.stops.map((stop) => {
          const town = stop.destination ? getDestination(stop.destination) : undefined;
          return (
            <li key={`${stop.when}-${stop.title}`} className="relative grid grid-cols-[0.875rem_1fr] gap-x-5">
              <span aria-hidden="true" className="relative z-10 mt-1.5 size-3.5 rounded-full bg-ink ring-4 ring-surface" />
              <div className="flex max-w-prose flex-col gap-1.5">
                <p className="text-[0.8125rem] font-semibold text-accent-text">{stop.when}</p>
                <h3 className="text-lg font-semibold leading-snug">{stop.title}</h3>
                <p className="leading-relaxed text-fg-muted">{stop.body}</p>
                {town ? (
                  <Link
                    href={`/destinations/${town.slug}`}
                    className="inline-flex w-fit items-center gap-1 text-[0.8125rem] font-semibold text-accent-text underline-offset-4 hover:underline"
                  >
                    {town.name} guide
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const image = photo(post.image);
  const towns = post.destinations.map((d) => getDestination(d)).filter((d) => d !== undefined);
  const shelves = post.shelves.map((s) => getShelf(s));
  const others = blogPosts.filter((p) => p.slug !== post.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.updated,
    dateModified: post.updated,
    keywords: post.seo.keywords.join(", "),
    inLanguage: brand.locale,
    image: `${env.siteUrl}${image.src}`,
    mainEntityOfPage: `${env.siteUrl}/blog/${post.slug}`,
    author: { "@type": "Organization", name: brand.name },
    url: `${env.siteUrl}/blog/${post.slug}`,
    publisher: { "@type": "Organization", name: brand.name },
  };

  return (
    <>
      <JsonLd
        data={[
          jsonLd,
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          faqJsonLd(post.faqs),
        ]}
      />

      <article aria-labelledby="post-title">
        <header className="container-editorial flex flex-col gap-6 pb-8 pt-10 lg:pb-10 lg:pt-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.tag }]} />
          <div className="flex max-w-4xl flex-col gap-4">
            <BlogMeta post={post} className="text-sm" />
            <TextReveal id="post-title" as="h1" text={post.title} className="font-display text-display-xl" />
            <p className="max-w-2xl text-lead text-fg-muted">{post.summary}</p>
          </div>
        </header>

        <div className="px-2 sm:px-4 lg:px-6">
          <MediaFrame
            src={image.src}
            alt={image.alt}
            aspect="aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]"
            sizes="100vw"
            className="rounded-xl sm:rounded-2xl"
            priority
          />
        </div>

        <div className="container-editorial grid gap-12 py-12 lg:grid-cols-12 lg:gap-16 lg:py-16">
          <div className="flex flex-col gap-12 lg:col-span-8">
            <div className="flex max-w-prose flex-col gap-4">
              {post.lead.map((p) => (
                <p key={p.slice(0, 32)} className="text-lead">
                  {p}
                </p>
              ))}
            </div>

            {post.plans.map((plan) => (
              <Plan key={plan.title} plan={plan} />
            ))}

            {post.sections.map((section) => (
              <section key={section.heading} className="flex flex-col gap-5">
                <h2 className="font-display text-display-md">{section.heading}</h2>
                {section.paragraphs?.map((p) => (
                  <p key={p.slice(0, 32)} className="max-w-prose leading-relaxed text-fg-muted">
                    {p}
                  </p>
                ))}
                {section.items ? (
                  <ul className="divide-y divide-line border-y border-line">
                    {section.items.map((item) => {
                      const town = item.destination ? getDestination(item.destination) : undefined;
                      return (
                        <li key={item.name} className="flex flex-col gap-1 py-4">
                          <p className="text-lg font-semibold">{item.name}</p>
                          <p className="text-fg-muted">{item.text}</p>
                          {town ? (
                            <Link
                              href={`/destinations/${town.slug}`}
                              className="inline-flex w-fit items-center gap-1 text-[0.8125rem] font-semibold text-accent-text underline-offset-4 hover:underline"
                            >
                              {town.name} guide
                              <ArrowUpRight className="size-3.5" aria-hidden="true" />
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            ))}

            <section aria-labelledby="post-faqs" className="flex flex-col gap-5">
              <h2 id="post-faqs" className="font-display text-display-md">
                Common questions
              </h2>
              <div className="divide-y divide-line border-y border-line">
                {post.faqs.map((faq) => (
                  <details key={faq.question} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <span aria-hidden="true" className="text-2xl text-accent-text transition-transform duration-300 group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="max-w-prose pt-3 leading-relaxed text-fg-muted">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section aria-labelledby="post-tips" className="theme-sage flex flex-col gap-5 rounded-xl p-6 lg:p-8">
              <h2 id="post-tips" className="font-display text-display-sm">
                Before you go
              </h2>
              <ul className="flex flex-col gap-3">
                {post.tips.map((tip) => (
                  <li key={tip.slice(0, 32)} className="border-l-2 border-burnt pl-4 text-[0.9375rem] leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside aria-label="Plan this trip" className="lg:col-span-4">
            <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface-raised p-6 lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
              <h2 className="font-display text-display-sm">Plan this trip</h2>
              {towns.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-fg-muted">Town guides</p>
                  <ul className="flex flex-col divide-y divide-line border-y border-line">
                    {towns.map((town) => (
                      <li key={town.slug}>
                        <Link href={`/destinations/${town.slug}`} className="group flex items-center justify-between gap-3 py-3 font-semibold">
                          {town.name}
                          <ArrowUpRight
                            aria-hidden="true"
                            className="size-4 text-fg-muted transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-text"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-fg-muted">Search and book</p>
                <ul className="flex flex-wrap gap-2">
                  {shelves.map((shelf) => (
                    <li key={shelf.slug}>
                      <Link
                        href={shelf.href}
                        className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm font-semibold transition-colors duration-200 hover:border-fg hover:bg-fg/5"
                      >
                        {shelf.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-[0.8125rem] leading-relaxed text-fg-muted">
                  Listings appear only after a partner is verified, so some of these may still be empty.
                </p>
              </div>
              <p className="border-t border-line pt-4 text-[0.8125rem] text-fg-muted">
                Updated <time dateTime={post.updated}>{updatedFormat.format(new Date(`${post.updated}T12:00:00+05:30`))}</time>
              </p>
            </div>
          </aside>
        </div>
      </article>

      <section aria-labelledby="more-posts" className="bg-surface-sunken py-12 lg:py-16">
        <div className="container-editorial flex flex-col gap-8">
          <h2 id="more-posts" className="font-display text-display-md">
            More from the blog
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => (
              <li key={other.slug}>
                <BlogCard post={other} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
