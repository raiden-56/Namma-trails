import type { Metadata } from "next";
import { CategoryLanding, categoryMetadata } from "@/components/sections/CategoryLanding";

export const metadata: Metadata = categoryMetadata("packages");

export default function Page() {
  return <CategoryLanding slug="packages" />;
}
