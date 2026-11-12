import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PartnerGate, PartnerIdentity } from "@/features/partner/PartnerSession";

export const metadata: Metadata = { title: { default: "Partner portal", template: "%s · Partner portal" }, robots: { index: false, follow: false } };

/** Provider portal: professional, practical, operations-focused. Access is enforced by the API; the gate is UX. */
export default function PartnerPortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Partner portal" section="partner" density="comfortable" homeHref="/partner" topbar={<PartnerIdentity />}>
      <PartnerGate>{children}</PartnerGate>
    </PortalShell>
  );
}
