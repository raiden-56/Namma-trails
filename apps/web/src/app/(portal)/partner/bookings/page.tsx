import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/States";
import { PartnerBookings } from "@/features/partner/PartnerBookings";

export const metadata: Metadata = { title: "Bookings" };

export default function PartnerBookingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <PartnerBookings />
    </Suspense>
  );
}
