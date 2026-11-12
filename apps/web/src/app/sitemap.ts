import type { MetadataRoute } from "next";
import { categoryShelves } from "@/config/categories";
import { blogPosts } from "@/content/blog";
import { destinations } from "@/content/destinations";
import { apiFetch } from "@/lib/api/client";
import { env } from "@/lib/env";

const PAGE_SIZE = 48;

/**
 * Addresses of the published listings, read from the public search API so search
 * engines can find every listing page. If the API cannot be reached the site map is
 * still produced, just without the listings.
 */
async function listingPaths(): Promise<string[]> {
  const paths: string[] = [];
  try {
    for (let page = 1; page <= 20; page++) {
      const res = await apiFetch<{ data: { slug: string }[]; meta?: { total?: number } }>(`/search/services?pageSize=${PAGE_SIZE}&page=${page}`, {
        cache: "no-store",
      });
      paths.push(...res.data.map((service) => `/services/${service.slug}`));
      if (res.data.length < PAGE_SIZE || paths.length >= (res.meta?.total ?? 0)) break;
    }
  } catch {
    // Leave the listings out rather than fail the whole site map.
  }
  return paths;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = ["/", "/destinations", "/explore", "/blog", "/user-manual", "/partner/join", "/partner/register"];
  const listings = await listingPaths();
  return [
    ...staticRoutes.map((path) => ({ url: `${env.siteUrl}${path}`, lastModified: now, changeFrequency: "weekly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...categoryShelves.map((s) => ({ url: `${env.siteUrl}${s.href}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...destinations
      .filter((d) => d.status !== "draft")
      .map((d) => ({ url: `${env.siteUrl}/destinations/${d.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 })),
    ...blogPosts.map((post) => ({ url: `${env.siteUrl}/blog/${post.slug}`, lastModified: new Date(post.updated), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...listings.map((path) => ({ url: `${env.siteUrl}${path}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
