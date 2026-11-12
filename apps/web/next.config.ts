import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
