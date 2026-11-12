import type { ReactNode } from "react";
import { BackToTop } from "@/components/layout/BackToTop";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

/** Public editorial site: immersive, image-led. Smooth scroll is enabled only here. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <PublicHeader />
      <main id="main">{children}</main>
      <PublicFooter />
      <BackToTop />
    </>
  );
}
