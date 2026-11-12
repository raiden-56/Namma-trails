import { brand } from "@/config/brand";
import { photo, type PhotoKey } from "@/content/photos";
import { env } from "./env";

/** Absolute URL for a site path, built from the configured site origin. */
export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Open Graph / Twitter image entry for a local image path. */
export function shareImage(src: string, alt: string, width = 1600, height = 1067) {
  return [{ url: src, width, height, alt }];
}

/** Share image for one of the licensed photos in content/photos.ts. */
export function photoShareImage(key: PhotoKey) {
  const p = photo(key);
  return shareImage(p.src, p.alt, p.width, p.height);
}

type ShareImages = ReturnType<typeof shareImage>;

/**
 * The Open Graph block for a page. A page's `openGraph` replaces the layout's instead of
 * being merged with it, so every page builds the whole block here: the site name, the
 * locale and a share image are then always present.
 */
export function pageOpenGraph({ url, title, description, images }: { url?: string; title?: string; description?: string; images?: ShareImages } = {}) {
  return {
    type: "website" as const,
    siteName: brand.name,
    locale: "en_IN",
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    images: images ?? photoShareImage("gokarna-headland-blue-sky"),
  };
}

/** Same as pageOpenGraph, for an article (blog post). */
export function articleOpenGraph({ url, title, description, images, modifiedTime }: { url: string; title: string; description: string; images: ShareImages; modifiedTime: string }) {
  return { type: "article" as const, siteName: brand.name, locale: "en_IN", url, title, description, images, modifiedTime };
}

/** schema.org BreadcrumbList. The last item is the current page. */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

/** schema.org FAQPage. Only use for questions and answers that are visible on the page. */
export function faqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

/** schema.org WebSite + Organization for the homepage. */
export function siteJsonLd() {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: brand.name, url: env.siteUrl, description: brand.description, inLanguage: brand.locale },
    { "@context": "https://schema.org", "@type": "Organization", name: brand.name, url: env.siteUrl, description: brand.description, areaServed: brand.region },
  ];
}
