import type { Metadata } from "next";
import { CategoryLanding, categoryMetadata } from "@/components/sections/CategoryLanding";

export const metadata: Metadata = categoryMetadata("experiences");

export default function Page() {
  return <CategoryLanding slug="experiences" />;
}
