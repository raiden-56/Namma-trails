import type { Metadata } from "next";
import { PartnerListings } from "@/features/partner/PartnerListings";

export const metadata: Metadata = { title: "Listings" };

export default function PartnerListingsPage() {
  return <PartnerListings />;
}
