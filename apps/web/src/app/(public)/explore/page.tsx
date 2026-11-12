import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "@/components/sections/explore/ExploreView";
import { Skeleton } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Search stays, boat rides, rentals and guides",
  description: "Search verified stays, boat rides, scooty and car rentals, cabs, local guides and experiences in Gokarna, Murudeshwar, Karwar and Udupi.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="container-editorial py-10"><Skeleton className="h-96" /></div>}>
      <ExploreView />
    </Suspense>
  );
}
