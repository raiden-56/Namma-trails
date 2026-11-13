import path from "node:path";
import type { NextConfig } from "next";

// The Docker image (apps/web/Dockerfile) sets NEXT_OUTPUT=standalone. The build then writes a
// small self-contained server to .next/standalone, traced from the repository root so the
// workspace package @kt/domain is included. Local dev and plain builds are not affected.
const standalone = process.env.NEXT_OUTPUT === "standalone";

/**
 * Where uploaded pictures may come from. Nothing else is allowed.
 *   - the site's own CDN path: <NEXT_PUBLIC_SITE_URL>/media/...  (on AWS, CloudFront reads it from S3)
 *   - NEXT_PUBLIC_MEDIA_URL, when set: a local S3 stand-in, e.g. http://localhost:9090/kt-public
 */
function mediaPatterns() {
  const patterns: Array<{ protocol: "http" | "https"; hostname: string; port: string; pathname: string }> = [];
  const allow = (address: string | undefined, suffix: string) => {
    if (!address) return;
    try {
      const url = new URL(address);
      patterns.push({
        protocol: url.protocol === "http:" ? "http" : "https",
        hostname: url.hostname,
        port: url.port,
        pathname: `${url.pathname.replace(/\/$/, "")}${suffix}`,
      });
    } catch {
      // Not a full address: nothing to allow.
    }
  };
  allow(process.env.NEXT_PUBLIC_SITE_URL, "/media/**");
  allow(process.env.NEXT_PUBLIC_MEDIA_URL, "/**");
  return patterns;
}

const nextConfig: NextConfig = {
  ...(standalone ? { output: "standalone" as const, outputFileTracingRoot: path.join(process.cwd(), "../../") } : {}),
  reactStrictMode: true,
  transpilePackages: ["@kt/domain"],
  images: {
    // Pictures that ship with the site need no entry. Uploaded pictures live in S3 and are
    // only accepted from the addresses above.
    remotePatterns: mediaPatterns(),
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  // Dev only: lets a phone on the same Wi-Fi load the dev server (e.g. DEV_ALLOWED_ORIGINS=192.168.0.107).
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
};

export default nextConfig;
