"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowLeft, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { traveler, type BookingDetail } from "@/lib/api/marketplace";
import { cn } from "@/lib/cn";
import { MediaFrame } from "@/components/media/MediaFrame";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtDateTime, fmtRange, fmtTime } from "@/features/booking/format";
import { PriceLines, inrPaise } from "@/features/booking/PriceLines";

const EVENT_LABEL: Record<string, string> = {
  booking_created: "Booking started",
  checkout_started: "Checking availability",
  inventory_held: "Held for you",
  provider_accepted: "Partner accepted",
  payment_verified: "Payment received — confirmed",
  payment_failed: "Payment failed",
  hold_expired: "Hold ran out",
  provider_rejected: "Partner declined",
  traveler_withdrew: "You withdrew the request",
  traveler_abandoned: "You cancelled before paying",
  service_started: "Started",
  service_completed: "Completed",
  traveler_requested_cancellation: "You asked to cancel",
  cancellation_accepted: "Cancellation accepted",
  cancellation_accepted_no_refund_due: "Cancelled (no refund due)",
  cancelled_by_provider_or_platform: "Cancelled by the partner",
  refund_settled_full: "Refunded in full",
  refund_settled_partial: "Partly refunded",
  provider_response_timeout: "Partner did not respond in time",
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Itinerary({ b }: { b: BookingDetail }) {
  const r = b.request;
  const rows: [string, string][] = [];
  if (r.checkIn && r.checkOut) {
    rows.push(["Check-in", fmtDateTime(b.startsAt)], ["Check-out", fmtDateTime(b.endsAt)], ["Rooms", String(b.units)]);
  } else if (r.pickupAt && r.returnAt) {
    rows.push(["Pickup", fmtDateTime(b.startsAt)], ["Return", fmtDateTime(b.endsAt)], ["Vehicles", String(b.units)]);
  } else {
    rows.push(["When", fmtRange(b.startsAt, b.endsAt)]);
  }
  if (r.route) rows.push(["Route", r.route.name]);
  rows.push(["People", `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`]);
  if (b.guests.length) rows.push(["Lead guest", b.guests.find((g) => g.isLead)?.fullName ?? b.guests[0]!.fullName]);
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-fg-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CancelDialog({ b, open, onClose }: { b: BookingDetail; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => traveler.cancel(b.reference, reason.trim()),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["booking", b.reference] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast({ title: "Booking cancelled", description: data.refund ? `Refund of ${inrPaise(data.refund.total)} is on its way.` : undefined, tone: "success" });
      onClose();
    },
  });
  const paid = b.status === "confirmed";
  const preview = b.refundPreview;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel this booking?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep booking
          </Button>
          <Button variant="danger" loading={cancel.isPending} disabled={reason.trim().length < 3} onClick={() => cancel.mutate()}>
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {paid && preview ? (
          <div className="rounded-lg bg-surface-sunken p-3 text-sm" data-testid="refund-preview">
            <p className="text-base font-semibold">You'll get back {inrPaise(preview.total)}</p>
            <p className="text-fg-muted">{preview.reason}</p>
            {preview.depositRefund > 0 ? <p className="text-fg-muted">Includes your {inrPaise(preview.depositRefund)} deposit.</p> : null}
            {preview.refundBps < 10_000 ? <p className="mt-1 text-xs text-fg-muted">Refunds follow the cancellation policy you accepted when booking.</p> : null}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">You haven't paid for this booking, so nothing is charged. The {b.status === "awaiting_provider_confirmation" ? "request" : "hold"} will be released.</p>
        )}
        <Field id="cancel-reason" label="Reason">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Plans changed" />
        </Field>
        {cancel.isError ? (
          <p role="alert" className="text-sm text-danger">
            {cancel.error.message}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function ReviewForm({ reference }: { reference: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const review = useMutation({
    mutationFn: () => traveler.review(reference, { rating, ...(title.trim() ? { title: title.trim() } : {}), ...(body.trim() ? { body: body.trim() } : {}) }),
    onSuccess: async () => {
      toast({ title: "Thanks for your review", tone: "success" });
      await queryClient.invalidateQueries({ queryKey: ["booking", reference] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
  return (
    <Card title="How was it?">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (rating) review.mutate();
        }}
      >
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Your rating</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer rounded-md p-1 has-focus-visible:outline-2 has-focus-visible:outline-accent-text">
                <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} />
                <Star className={cn("size-7", n <= rating ? "fill-butter text-butter-deep" : "text-line-strong")} aria-hidden="true" />
                <span className="sr-only">{n} star{n === 1 ? "" : "s"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="rv-title" label="Title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field id="rv-body" label="Your review (optional)">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        </Field>
        {review.isError ? (
          <p role="alert" className="text-sm text-danger">
            {review.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={!rating} loading={review.isPending} className="self-start">
          Post review
        </Button>
      </form>
    </Card>
  );
}

export function TripDetail({ reference, requested }: { reference: string; requested?: boolean }) {
  const booking = useQuery({ queryKey: ["booking", reference], queryFn: () => traveler.booking(reference) });
  const [cancelOpen, setCancelOpen] = useState(false);
  if (booking.isPending) return <Skeleton className="h-96" />;
  if (booking.isError) return <ErrorState title="We couldn't load this booking" description={booking.error.message} />;
  const b = booking.data.data;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/trips" className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> My Trips
      </Link>

      {requested && b.status === "awaiting_provider_confirmation" ? (
        <p role="status" className="rounded-lg border border-info/40 bg-info/5 p-4 text-sm">
          <strong>Request sent.</strong> {b.provider.name} will confirm availability. Nothing is charged until they accept — you'll then be asked to pay.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <MediaFrame src={b.service.coverImageUrl} alt={b.service.title} className="size-20 shrink-0 rounded-lg sm:size-24" sizes="96px" showPlaceholderNote={false} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg-muted">
            {b.service.category} · {b.service.destination}
          </p>
          <h1 className="font-display text-display-sm">
            <Link href={`/services/${b.service.slug}`} className="hover:underline">
              {b.service.title}
            </Link>
          </h1>
          <p className="text-sm text-fg-muted">
            {b.reference} · trip {b.tripReference}
          </p>
        </div>
        <StatusChip kind="booking" status={b.status} />
      </div>

      {b.pendingPayment ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning/15 p-4 text-sm">
          <span>
            Payment of <strong>{inrPaise(b.pendingPayment.amountPaise)}</strong> is due{b.holdExpiresAt ? ` by ${fmtTime(b.holdExpiresAt)} on ${fmtDate(b.holdExpiresAt, { weekday: undefined })}` : ""}.
          </span>
          <Button href={`/checkout/${b.reference}`} size="sm">
            Complete payment
          </Button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title="Itinerary">
            <Itinerary b={b} />
          </Card>

          <Card title="Price">
            <PriceLines lines={b.quote.lines} total={b.totalPaise} totalLabel="Total" />
            {b.refunds.length ? (
              <ul className="flex flex-col gap-1 border-t border-line pt-2 text-sm" data-testid="refunds">
                {b.refunds.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-fg-muted">
                      Refund {r.status} · {fmtDate(r.createdAt, { weekday: undefined })}
                    </span>
                    <span className="tabular-nums text-success">{inrPaise(r.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {b.locations.length || b.safetyInfo ? (
            <Card title="On the day">
              {b.locations.map((l) => (
                <p key={l.name} className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{l.name}</span>
                    {l.addressLine ? <span className="block text-fg-muted">{l.addressLine}</span> : null}
                    {l.instructions ? <span className="block text-fg-muted">{l.instructions}</span> : null}
                  </span>
                </p>
              ))}
              {b.safetyInfo ? (
                <p className="flex items-start gap-2 text-sm text-fg-muted">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {b.safetyInfo}
                </p>
              ) : null}
            </Card>
          ) : null}

          {b.canReview ? <ReviewForm reference={b.reference} /> : null}
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Partner">
            <p className="text-sm font-semibold">{b.provider.name}</p>
            {b.provider.phone ? (
              <a href={`tel:${b.provider.phone}`} className="flex items-center gap-2 text-sm underline underline-offset-4">
                <Phone className="size-4" aria-hidden="true" /> {b.provider.phone}
              </a>
            ) : (
              <p className="text-xs text-fg-muted">Contact details appear once your booking is confirmed.</p>
            )}
          </Card>

          <Card title="Timeline">
            <ol className="flex flex-col gap-2 border-l border-line pl-3">
              {b.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{EVENT_LABEL[h.event] ?? h.event.replace(/_/g, " ")}</p>
                  <p className="text-xs text-fg-muted">{fmtDateTime(h.at)}</p>
                  {h.note ? <p className="text-xs text-fg-muted">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Card>

          {b.cancellable ? (
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>
              Cancel booking
            </Button>
          ) : null}
        </div>
      </div>

      {b.cancellable ? <CancelDialog b={b} open={cancelOpen} onClose={() => setCancelOpen(false)} /> : null}
    </div>
  );
}
