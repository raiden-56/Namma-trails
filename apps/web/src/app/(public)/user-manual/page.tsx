import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { breadcrumbJsonLd, pageOpenGraph, shareImage } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { loadManual, manualImageUrl, type ManualBlock } from "@/features/manual/load";
import type { Inline } from "@/features/manual/markdown";

/** The manual is read from docs/FEATURES.md when the site is built, then served as a static page. */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "User manual",
  description: `How to use ${brand.name}: the booking flow step by step and every screen for travellers, local partners and the team, with screenshots.`,
  keywords: [`${brand.name} user manual`, "how to book a Gokarna trip online", "how to book stays and boat rides", "partner registration guide", "coastal Karnataka booking help"],
  alternates: { canonical: "/user-manual" },
  openGraph: pageOpenGraph({ url: "/user-manual", images: shareImage("/manual/landing-hero.jpg", "The landing page", 1440, 900) }),
};

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, i) => {
    if (node.type === "text") return node.text;
    if (node.type === "strong") {
      return (
        <strong key={i} className="font-semibold text-fg">
          {renderInline(node.children)}
        </strong>
      );
    }
    if (node.type === "code") {
      return (
        <code key={i} className="rounded-xs bg-fg/8 px-1.5 py-0.5 font-mono text-[0.875em] text-fg">
          {node.text}
        </code>
      );
    }
    const linkClass = "font-semibold text-accent-text underline underline-offset-4";
    const picture = manualImageUrl(node.href);
    if (picture) {
      return (
        <a key={i} href={picture} className={linkClass}>
          {renderInline(node.children)}
        </a>
      );
    }
    if (/^https?:\/\//.test(node.href)) {
      return (
        <a key={i} href={node.href} className={linkClass} target="_blank" rel="noopener">
          {renderInline(node.children)}
        </a>
      );
    }
    if (node.href.startsWith("/")) {
      return (
        <Link key={i} href={node.href} className={linkClass}>
          {renderInline(node.children)}
        </Link>
      );
    }
    // Links to other files in the repository mean nothing on the website: keep the words only.
    return <span key={i}>{renderInline(node.children)}</span>;
  });
}

function BlockView({ block }: { block: ManualBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 id={block.id} className="scroll-mt-[calc(var(--header-h)+1.5rem)] pt-6 text-xl font-semibold leading-snug">
          {block.text}
        </h3>
      );
    case "paragraph":
      return <p className="max-w-prose leading-relaxed text-fg-muted">{renderInline(block.inlines)}</p>;
    case "quote":
      return <p className="rounded-lg border-l-2 border-accent bg-surface-sunken py-3 pl-4 pr-4 text-[0.9375rem] leading-relaxed">{renderInline(block.inlines)}</p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`flex max-w-prose flex-col gap-1.5 pl-5 leading-relaxed text-fg-muted ${block.ordered ? "list-decimal" : "list-disc"}`}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col" className="border-b border-line-strong px-4 py-3 font-semibold">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-line last:border-b-0">
                  {row.map((cell, c) => (
                    <td key={c} className="px-4 py-3 align-top leading-relaxed text-fg-muted first:text-fg">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg bg-ink p-4 font-mono text-sm leading-relaxed text-cream">
          <code>{block.text}</code>
        </pre>
      );
    case "pictures":
      return (
        <div className="flex flex-wrap gap-5">
          {block.items.map((picture) => {
            // Very tall screenshots show their top part only; the picture opens in full when clicked.
            const phone = picture.width !== undefined;
            const tall = picture.fileHeight / picture.fileWidth > (phone ? 2.2 : 0.95);
            return (
              <figure key={picture.src} className="flex min-w-0 flex-col gap-2" style={phone ? { width: picture.width, maxWidth: "100%" } : { width: "100%" }}>
                <a
                  href={picture.src}
                  className={cn(
                    "relative block overflow-hidden rounded-lg border border-line bg-surface-raised shadow-card",
                    tall && (phone ? "max-h-[41rem]" : "max-h-[46rem]"),
                  )}
                >
                  <Image
                    src={picture.src}
                    alt={picture.alt}
                    width={picture.fileWidth}
                    height={picture.fileHeight}
                    sizes={phone ? `${picture.width}px` : "(min-width: 1024px) 60rem, 100vw"}
                    className="h-auto w-full"
                  />
                  {tall ? <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-raised to-transparent" /> : null}
                </a>
                <figcaption className="text-[0.8125rem] text-fg-muted">
                  {picture.alt}
                  {tall ? " (top part shown; open the picture to see all of it)" : ""}
                </figcaption>
              </figure>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

export default function UserManualPage() {
  const manual = loadManual();
  if (!manual) notFound();

  return (
    <div className="container-editorial flex flex-col gap-10 py-10 lg:py-14">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "User manual", path: "/user-manual" },
        ])}
      />
      <header className="flex flex-col gap-5">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "User manual" }]} />
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="eyebrow">Help</p>
          <h1 className="font-display text-display-xl">{manual.title}</h1>
          {manual.intro.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <nav aria-label="In this manual" className="lg:col-span-3">
          <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
            <p className="text-sm font-semibold text-fg-muted">In this manual</p>
            <ol className="flex flex-col divide-y divide-line border-y border-line text-[0.9375rem]">
              {manual.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="block py-2.5 font-semibold underline-offset-4 hover:text-accent-text hover:underline">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-14 lg:col-span-9">
          {manual.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-5">
              <h2 id={section.id} className="scroll-mt-[calc(var(--header-h)+1.5rem)] border-t border-line-strong pt-8 font-display text-display-md">
                {section.title}
              </h2>
              {section.blocks.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
