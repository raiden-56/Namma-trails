import type { Metadata } from "next";
import { Suspense } from "react";
import { ProvidersAdmin } from "@/features/admin/ProvidersAdmin";
import { Skeleton } from "@/components/ui/States";

export const metadata: Metadata = { title: "Provider applications" };

export default function ProvidersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ProvidersAdmin />
    </Suspense>
  );
}
