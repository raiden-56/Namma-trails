"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SessionGate } from "@/features/auth/session";
import { EmptyState } from "@/components/ui/States";

/** Traveller pages need a signed-in user; signed-out visitors go to sign-in and come back. */
export function RequireSignIn({ children }: { children: ReactNode }) {
  return (
    <SessionGate
      allow={() => true}
      denied={<EmptyState title="Sign in to continue" action={<Button href="/sign-in">Sign in</Button>} />}
    >
      {children}
    </SessionGate>
  );
}
