import type { Metadata } from "next";
import { PartnerDashboard } from "@/features/partner/PartnerDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function PartnerDashboardPage() {
  return <PartnerDashboard />;
}
