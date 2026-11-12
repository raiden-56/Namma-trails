"use client";

import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useMe } from "@/features/auth/session";

/** The organisation the partner portal acts for: the signed-in user's first active membership. */
export function usePartnerId(): string | null {
  return useMe().data?.providers[0]?.id ?? null;
}

export const ADMIN_DENIED = "This area belongs to another admin role. Ask a super admin if you need access.";

const IST = "Asia/Kolkata";
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });

/** A same-day range prints once ("3 Dec, 07:30 – 08:30"); multi-day shows both ends. */
export function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = s.toLocaleDateString("en-IN", { timeZone: IST }) === e.toLocaleDateString("en-IN", { timeZone: IST });
  return sameDay
    ? `${fmtDateTime(startIso)} – ${e.toLocaleTimeString("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit" })}`
    : `${fmtDateTime(startIso)} → ${fmtDateTime(endIso)}`;
}

export function partyLabel(adults: number, children: number) {
  return `${adults} adult${adults === 1 ? "" : "s"}${children ? `, ${children} child${children === 1 ? "" : "ren"}` : ""}`;
}

/**
 * Standard loading / error wrapper. A 403 means the member's role does not include
 * this area (e.g. front desk staff opening Finance): say so plainly.
 */
export function QueryState({
  isPending,
  error,
  children,
  what,
  deniedHint = "Ask the business owner to change your role if you need access.",
}: {
  isPending: boolean;
  error: Error | null;
  children: () => ReactNode;
  what: string;
  deniedHint?: string;
}) {
  if (isPending) return <Skeleton className="h-64" />;
  if (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <ErrorState
          title={`Your role doesn't include ${what}`}
          description={deniedHint}
        />
      );
    }
    return <ErrorState title={`Couldn't load ${what}`} description={error.message} />;
  }
  return <>{children()}</>;
}

export function PageHeader({ title, description, aside }: { title: string; description?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-display-sm">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}
