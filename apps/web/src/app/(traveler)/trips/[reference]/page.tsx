import type { Metadata } from "next";
import { RequireSignIn } from "@/features/trips/RequireSignIn";
import { TripDetail } from "@/features/trips/TripDetail";

export const metadata: Metadata = { title: "Booking" };

export default async function TripDetailPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ requested?: string }> }) {
  const [{ reference }, { requested }] = await Promise.all([params, searchParams]);
  return (
    <RequireSignIn>
      <TripDetail reference={reference} requested={requested === "1"} />
    </RequireSignIn>
  );
}
