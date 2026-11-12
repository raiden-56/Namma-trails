import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Longest-match wins: public partner marketing pages stay crawlable, the portal does not.
        allow: ["/", "/partner/join", "/partner/register"],
        disallow: ["/admin", "/partner", "/trips", "/saved", "/account", "/sign-in", "/design-system"],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
