"use client";

import type { ReactNode } from "react";
import { PortalIdentity, SessionGate } from "@/features/auth/session";
import { PartnerNoOrganisation, partnerAllowed } from "./PartnerDashboard";

export function PartnerGate({ children }: { children: ReactNode }) {
  return (
    <SessionGate allow={partnerAllowed} denied={<PartnerNoOrganisation />} signInQuery="as=partner&">
      {children}
    </SessionGate>
  );
}

export function PartnerIdentity() {
  // Role only: the business name is the dashboard heading, and a long badge overflows phone top bars.
  return <PortalIdentity badges={(me) => me.providers.slice(0, 1).map((p) => p.role.replace(/_/g, " "))} />;
}
