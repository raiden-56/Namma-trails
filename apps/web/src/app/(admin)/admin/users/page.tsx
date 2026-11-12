import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersAdmin } from "@/features/admin/UsersAdmin";
import { Skeleton } from "@/components/ui/States";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <UsersAdmin />
    </Suspense>
  );
}
