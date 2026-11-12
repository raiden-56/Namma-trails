import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BookingStatus, DestinationStatus, DocumentStatus, ListingStatus, ProviderStatus } from "@/lib/catalog";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-fg/8 text-fg",
  accent: "bg-accent/15 text-accent-text",
  success: "bg-success/15 text-success",
  warning: "bg-butter/45 text-warning",
  danger: "bg-danger/12 text-danger",
  info: "bg-info/12 text-info",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

type StatusKind = "provider" | "listing" | "booking" | "document" | "destination";

const statusMap: {
  provider: Record<ProviderStatus, [string, Tone]>;
  listing: Record<ListingStatus, [string, Tone]>;
  booking: Record<BookingStatus, [string, Tone]>;
  document: Record<DocumentStatus, [string, Tone]>;
  destination: Record<DestinationStatus, [string, Tone]>;
} = {
  provider: {
    draft: ["Draft", "neutral"],
    submitted: ["Submitted", "info"],
    under_review: ["Under review", "info"],
    info_requested: ["Info requested", "warning"],
    approved: ["Approved", "success"],
    rejected: ["Rejected", "danger"],
    suspended: ["Suspended", "danger"],
    expired: ["Expired", "warning"],
  },
  listing: {
    draft: ["Draft", "neutral"],
    pending_review: ["Pending review", "info"],
    changes_requested: ["Changes requested", "warning"],
    approved: ["Approved", "success"],
    published: ["Published", "success"],
    paused: ["Paused", "neutral"],
    rejected: ["Rejected", "danger"],
    archived: ["Archived", "neutral"],
  },
  booking: {
    draft: ["Draft", "neutral"],
    pending_availability: ["Checking availability", "info"],
    awaiting_provider_confirmation: ["Awaiting partner", "warning"],
    awaiting_payment: ["Awaiting payment", "warning"],
    confirmed: ["Confirmed", "success"],
    in_progress: ["In progress", "info"],
    completed: ["Completed", "success"],
    cancellation_requested: ["Cancellation requested", "warning"],
    cancelled: ["Cancelled", "neutral"],
    refund_pending: ["Refund pending", "warning"],
    partially_refunded: ["Partially refunded", "info"],
    refunded: ["Refunded", "neutral"],
    failed: ["Failed", "danger"],
    expired: ["Expired", "neutral"],
    disputed: ["Disputed", "danger"],
  },
  document: {
    pending: ["Pending check", "info"],
    verified: ["Verified", "success"],
    rejected: ["Rejected", "danger"],
    expired: ["Expired", "warning"],
    superseded: ["Replaced", "neutral"],
  },
  destination: {
    draft: ["Draft", "neutral"],
    onboarding: ["Onboarding partners", "accent"],
    active: ["Live", "success"],
    temporarily_unavailable: ["Temporarily unavailable", "warning"],
  },
};

type StatusFor<K extends StatusKind> = keyof (typeof statusMap)[K];

/** Maps a domain status to a consistent label + tone across traveller, partner and admin UIs. */
export function StatusChip<K extends StatusKind>({ kind, status, className }: { kind: K; status: StatusFor<K>; className?: string }) {
  const entry = (statusMap[kind] as Record<string, [string, Tone]>)[status as string] ?? [String(status), "neutral"];
  const [label, tone] = entry;
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
