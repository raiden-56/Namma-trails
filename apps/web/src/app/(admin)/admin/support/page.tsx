import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/States";
import { SupportAdmin } from "@/features/admin/SupportAdmin";

export const metadata: Metadata = { title: "Support" };

export default function AdminSupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <SupportAdmin />
    </Suspense>
  );
}
