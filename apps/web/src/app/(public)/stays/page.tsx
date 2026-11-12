import type { Metadata } from "next";
import { CategoryLanding, categoryMetadata } from "@/components/sections/CategoryLanding";

export const metadata: Metadata = categoryMetadata("stays");

export default function Page() {
  return <CategoryLanding slug="stays" />;
}
