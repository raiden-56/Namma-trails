"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { PortalIdentity, SessionGate } from "@/features/auth/session";

export { useMe } from "@/features/auth/session";

export function AdminGate({ children }: { children: ReactNode }) {
  return (
    <SessionGate
      allow={(me) => me.permissions.includes("admin.dashboard.view")}
      denied={
        <ErrorState
          title="You don't have access to the admin dashboard"
          description="This area is for platform administrators. If you need access, ask a super admin to grant you a role."
          action={
            <Button href="/" variant="secondary" size="sm">
              Back to the site
            </Button>
          }
        />
      }
    >
      {children}
    </SessionGate>
  );
}

export function AdminIdentity() {
  return (
    <div data-testid="admin-identity">
      <PortalIdentity badges={(me) => me.roles.filter((r) => r !== "traveler").map((r) => r.replace(/_/g, " "))} />
    </div>
  );
}
