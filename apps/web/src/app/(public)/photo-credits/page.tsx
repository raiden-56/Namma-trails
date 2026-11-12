import type { Metadata } from "next";
import Image from "next/image";
import { photos } from "@/content/photos";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Credits and licences for the photographs used on this site.",
  alternates: { canonical: "/photo-credits" },
};

/** Attribution required by the CC BY / CC BY-SA licences of the photos we use; Unsplash photos are credited as a courtesy. */
export default function PhotoCreditsPage() {
  return (
    <div className="container-editorial flex flex-col gap-8 py-12 lg:py-16">
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="eyebrow">Credits</p>
        <h1 className="font-display text-display-lg">Photo credits</h1>
        <p className="text-fg-muted">
          These photographs come from Wikimedia Commons and Unsplash and are used under the licences shown. Thank you to the photographers. Images may be cropped for
          layout; no other changes have been made.
        </p>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <li key={p.key} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface-raised">
            <div className="relative aspect-[3/2]">
              <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-col gap-1 p-4 text-sm">
              <p className="font-semibold">{p.alt}</p>
              <p className="text-fg-muted">
                “{p.credit.title}” by {p.credit.author}
              </p>
              <p className="flex flex-wrap gap-x-3">
                {p.credit.licenseUrl ? (
                  <a href={p.credit.licenseUrl} className="text-accent-text underline underline-offset-4" rel="license noopener" target="_blank">
                    {p.credit.license}
                  </a>
                ) : (
                  <span>{p.credit.license}</span>
                )}
                <a href={p.credit.sourceUrl} className="text-accent-text underline underline-offset-4" rel="noopener" target="_blank">
                  Source
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
