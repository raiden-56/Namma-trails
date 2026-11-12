import type { Metadata } from "next";
import { FinanceAdmin } from "@/features/admin/FinanceAdmin";

export const metadata: Metadata = { title: "Finance" };

export default function AdminFinancePage() {
  return <FinanceAdmin />;
}
