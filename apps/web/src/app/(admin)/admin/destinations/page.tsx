import type { Metadata } from "next";
import { DestinationsAdmin } from "@/features/admin/DestinationsAdmin";

export const metadata: Metadata = { title: "Destinations" };

export default function DestinationsPage() {
  return <DestinationsAdmin />;
}
