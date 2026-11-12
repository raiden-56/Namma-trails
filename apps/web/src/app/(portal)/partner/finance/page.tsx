import type { Metadata } from "next";
import { PartnerFinance } from "@/features/partner/PartnerFinance";

export const metadata: Metadata = { title: "Finance" };

export default function PartnerFinancePage() {
  return <PartnerFinance />;
}
