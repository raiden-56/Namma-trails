import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/States";
import { BookingsAdmin } from "@/features/admin/BookingsAdmin";

export const metadata: Metadata = { title: "Bookings" };

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <BookingsAdmin />
    </Suspense>
  );
}
