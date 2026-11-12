import type { Metadata } from "next";
import { RequireSignIn } from "@/features/trips/RequireSignIn";
import { TripsList } from "@/features/trips/TripsList";

export const metadata: Metadata = { title: "My Trips" };

export default function TripsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-display-sm">My Trips</h1>
      <RequireSignIn>
        <TripsList />
      </RequireSignIn>
    </div>
  );
}
