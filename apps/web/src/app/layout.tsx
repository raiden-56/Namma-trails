import type { Metadata, Viewport } from "next";
import { Archivo, Caveat, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import { siteKeywords } from "@/config/seo";
import { env } from "@/lib/env";
import { pageOpenGraph } from "@/lib/seo";
import { QueryProvider } from "@/lib/api/query-provider";
import { ToastProvider } from "@/components/ui/Toast";
import "@/styles/globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", style: ["normal", "italic"] });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap", weight: ["500"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  keywords: siteKeywords,
  category: "travel",
  creator: brand.name,
  publisher: brand.name,
  // Each page sets its own canonical URL. A canonical here would be inherited by every
  // page that has none and tell search engines those pages are copies of the homepage.
  // No url here: pages that set no Open Graph data of their own must not claim the homepage URL.
  openGraph: pageOpenGraph(),
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f8f2e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${archivo.variable} ${playfair.variable} ${caveat.variable}`}>
      <body className="min-h-dvh">
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
