import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { AdminGate, AdminIdentity } from "@/features/admin/AdminSession";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

/**
 * Super-admin: information-dense, structured, efficient. AdminGate is a UX
 * layer; access is enforced server-side by the API (RBAC) on every request.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Operations admin" section="admin" density="compact" homeHref="/admin" topbar={<AdminIdentity />}>
      <AdminGate>{children}</AdminGate>
    </PortalShell>
  );
}
