"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Phone } from "lucide-react";
import { partner, type PartnerBooking, type PartnerBookingAction } from "@/lib/api/marketplace";
import { cn } from "@/lib/cn";
import { formatInrFromPaise } from "@/lib/format";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { ReasonDialog } from "./ReasonDialog";
import { PageHeader, QueryState, fmtDateTime, fmtRange, partyLabel, usePartnerId } from "./shared";

type View = "requests" | "upcoming" | "past";
const VIEWS: { key: View; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

const ACTIONS: Record<PartnerBookingAction, { label: string; done: string; variant: "primary" | "secondary" | "danger"; reason: number; description?: string }> = {
  accept: { label: "Accept", done: "Accepted — the guest has been asked to pay", variant: "primary", reason: 0, description: "The guest will be asked to pay. The booking is confirmed once payment succeeds." },
  reject: { label: "Decline", done: "Request declined", variant: "danger", reason: 5, description: "The guest sees your reason. Nothing has been charged." },
  start: { label: "Mark started", done: "Marked as started", variant: "secondary", reason: 0 },
  complete: { label: "Mark completed", done: "Marked as completed", variant: "primary", reason: 0, description: "Your earnings become eligible for payout after the dispute window." },
  cancel: { label: "Cancel booking", done: "Booking cancelled and guest refunded", variant: "danger", reason: 5, description: "Because you are cancelling, the guest gets a full refund and your earnings for this booking are reversed." },
};

function actionsFor(status: PartnerBooking["status"]): PartnerBookingAction[] {
  if (status === "awaiting_provider_confirmation") return ["accept", "reject"];
  if (status === "confirmed") return ["start", "complete", "cancel"];
  if (status === "in_progress") return ["complete"];
  return [];
}

export function PartnerBookings() {
  const providerId = usePartnerId();
  const params = useSearchParams();
  const pathname = usePathname();
  const view: View = (VIEWS.find((v) => v.key === params.get("view"))?.key ?? "upcoming") as View;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = useState<{ booking: PartnerBooking; action: PartnerBookingAction } | null>(null);

  const q = useQuery({ queryKey: ["partner", "bookings", providerId, view], queryFn: () => partner.bookings(providerId!, view), enabled: Boolean(providerId), retry: false });
  const act = useMutation({
    mutationFn: (v: { reference: string; action: PartnerBookingAction; reason?: string }) => partner.act(providerId!, v.reference, v.action, v.reason),
    onSuccess: async (_r, v) => {
      toast({ title: `${v.reference}: ${ACTIONS[v.action].done}`, tone: "success" });
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["partner"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookings" description="Answer requests, see who is coming and close out completed services. Times are in IST." />

      <nav aria-label="Booking views" className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`${pathname}?view=${v.key}`}
            aria-current={v.key === view ? "page" : undefined}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold", v.key === view ? "border-fg bg-fg text-surface" : "border-line-strong text-fg-muted hover:text-fg")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <QueryState isPending={q.isPending} error={q.error} what="bookings">
        {() => (
          <Table<PartnerBooking>
            caption={`${view} bookings`}
            rows={q.data!.data}
            getRowKey={(b) => b.id}
            columns={[
              {
                key: "guest",
                header: "Guest",
                cell: (b) => (
                  <span className="flex flex-col">
                    <span className="font-semibold">{b.guest.name}</span>
                    {b.guest.phone ? (
                      <a href={`tel:${b.guest.phone}`} className="flex items-center gap-1 text-xs text-accent-text underline-offset-4 hover:underline">
                        <Phone className="size-3" aria-hidden="true" /> {b.guest.phone}
                      </a>
                    ) : null}
                    <span className="text-xs text-fg-muted">{b.reference}</span>
                  </span>
                ),
              },
              {
                key: "service",
                header: "Service",
                cell: (b) => (
                  <span className="flex flex-col">
                    <span>{b.service.title}</span>
                    <span className="text-xs text-fg-muted">{partyLabel(b.adults, b.children)}{b.units > 1 ? ` · ${b.units} units` : ""}</span>
                    {b.specialRequests ? <span className="text-xs italic text-fg-muted">“{b.specialRequests}”</span> : null}
                  </span>
                ),
              },
              {
                key: "when",
                header: "When",
                cell: (b) => (
                  <span className="flex flex-col">
                    <span>{fmtRange(b.startsAt, b.endsAt)}</span>
                    {b.status === "awaiting_provider_confirmation" && b.providerRespondBy ? (
                      <span className="text-xs font-semibold text-warning">Answer by {fmtDateTime(b.providerRespondBy)}</span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "money",
                header: "Total · your payout",
                align: "right",
                cell: (b) => (
                  <span className="flex flex-col">
                    <span>{formatInrFromPaise(b.totalPaise)}</span>
                    <span className="text-xs text-fg-muted">{b.payoutPaise !== null ? formatInrFromPaise(b.payoutPaise) : "after payment"}</span>
                  </span>
                ),
              },
              { key: "status", header: "Status", cell: (b) => <StatusChip kind="booking" status={b.status} /> },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                cell: (b) => {
                  const available = actionsFor(b.status);
                  if (available.length === 0) return <span className="text-fg-muted">—</span>;
                  return (
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {available.map((a) => (
                        <Button
                          key={a}
                          size="sm"
                          variant={ACTIONS[a].variant === "danger" ? "secondary" : ACTIONS[a].variant}
                          disabled={act.isPending}
                          onClick={() => {
                            act.reset();
                            if (ACTIONS[a].reason === 0 && !ACTIONS[a].description) act.mutate({ reference: b.reference, action: a });
                            else setPending({ booking: b, action: a });
                          }}
                        >
                          {ACTIONS[a].label}
                        </Button>
                      ))}
                    </span>
                  );
                },
              },
            ]}
            empty={
              <EmptyState
                title={view === "requests" ? "No requests waiting" : view === "upcoming" ? "No upcoming bookings" : "No past bookings"}
                description={view === "requests" ? "Bookings that need your confirmation show up here." : undefined}
              />
            }
          />
        )}
      </QueryState>

      <ReasonDialog
        open={Boolean(pending)}
        title={pending ? `${ACTIONS[pending.action].label} · ${pending.booking.reference}` : ""}
        description={pending ? ACTIONS[pending.action].description : undefined}
        confirmLabel={pending ? ACTIONS[pending.action].label : "Confirm"}
        variant={pending ? ACTIONS[pending.action].variant : "primary"}
        minLength={pending ? ACTIONS[pending.action].reason : 0}
        reasonLabel="Reason (the guest will see this)"
        busy={act.isPending}
        error={act.error?.message ?? null}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && act.mutate({ reference: pending.booking.reference, action: pending.action, ...(reason ? { reason } : {}) })}
      />
    </div>
  );
}
