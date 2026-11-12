import type { Metadata } from "next";
import { ListingsAdmin } from "@/features/admin/ListingsAdmin";

export const metadata: Metadata = { title: "Listings" };

export default function ListingsPage() {
  return <ListingsAdmin />;
}
