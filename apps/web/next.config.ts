import path from "node:path";
import type { NextConfig } from "next";

// The Docker image (apps/web/Dockerfile) sets NEXT_OUTPUT=standalone. The build then writes a
// small self-contained server to .next/standalone, traced from the repository root so the
// workspace package @kt/domain is included. Local dev and plain builds are not affected.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  ...(standalone ? { output: "standalone" as const, outputFileTracingRoot: path.join(process.cwd(), "../../") } : {}),
  reactStrictMode: true,
  transpilePackages: ["@kt/domain"],
  images: {
    // No remote image hosts are allowed until licensed media storage (S3/CDN) is configured.
    remotePatterns: [],
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
