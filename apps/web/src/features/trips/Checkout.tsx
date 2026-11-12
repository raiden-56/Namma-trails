"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, FlaskConical } from "lucide-react";
import { traveler } from "@/lib/api/marketplace";
import { MediaFrame } from "@/components/media/MediaFrame";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { fmtRange } from "@/features/booking/format";
import { PriceLines, inrPaise } from "@/features/booking/PriceLines";

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  return Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
}

export function Checkout({ reference }: { reference: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const booking = useQuery({ queryKey: ["booking", reference], queryFn: () => traveler.booking(reference) });
  const b = booking.data?.data;
  const secondsLeft = useCountdown(b?.holdExpiresAt ?? null);

  const pay = useMutation({
    mutationFn: (outcome: "success" | "failure") => traveler.completeMockPayment(b!.pendingPayment!.id, outcome),
    onSuccess: async (_res, outcome) => {
      await queryClient.invalidateQueries({ queryKey: ["booking", reference] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      if (outcome === "success") {
        toast({ title: "Payment received — your booking is confirmed", tone: "success" });
        router.push(`/trips/${reference}`);
      } else {
        toast({ title: "Payment failed", description: "Nothing was charged. The booking has been released.", tone: "danger" });
      }
    },
  });

  if (booking.isPending) return <Skeleton className="h-96" />;
  if (booking.isError) return <ErrorState title="We couldn't load this booking" description={booking.error.message} />;
  if (!b) return null;

  const expired = b.status === "expired" || (b.status === "awaiting_payment" && secondsLeft === 0);
  if (b.status !== "awaiting_payment" || !b.pendingPayment || expired) {
    return (
      <EmptyState
        icon={expired ? <Clock className="size-5" /> : <CheckCircle2 className="size-5" />}
        title={expired ? "The hold on this booking has run out" : b.status === "confirmed" ? "This booking is already paid" : "Nothing to pay for this booking"}
        description={expired ? "Seats and rooms are only held for a short time. Check availability again to book." : `Current status: ${b.status.replace(/_/g, " ")}.`}
        action={
          <>
            <Button href={`/trips/${reference}`}>View booking</Button>
            {expired ? (
              <Button href={`/services/${b.service.slug}`} variant="secondary">
                Book again
              </Button>
            ) : null}
          </>
        }
      />
    );
  }

  const mm = String(Math.floor((secondsLeft ?? 0) / 60)).padStart(2, "0");
  const ss = String((secondsLeft ?? 0) % 60).padStart(2, "0");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="eyebrow">Checkout</p>
        <h1 className="font-display text-display-sm">Complete your payment</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <section className="flex flex-col gap-4 self-start rounded-xl border border-line bg-surface-raised p-5 md:col-span-3">
          <div className="flex gap-3">
            <MediaFrame src={b.service.coverImageUrl} alt={b.service.title} className="size-20 shrink-0 rounded-lg" showPlaceholderNote={false} sizes="80px" />
            <div className="min-w-0">
              <p className="font-semibold">{b.service.title}</p>
              <p className="text-sm text-fg-muted">{fmtRange(b.startsAt, b.endsAt)}</p>
              <p className="text-xs text-fg-muted">
                {b.reference} · <StatusChip kind="booking" status={b.status} />
              </p>
            </div>
          </div>
          <PriceLines lines={b.quote.lines} total={b.totalPaise} totalLabel="Total to pay" />
        </section>

        <section className="flex flex-col gap-4 md:col-span-2">
          <p className="flex items-center gap-2 rounded-lg bg-warning/15 p-3 text-sm" role="timer" aria-live="off" data-testid="hold-countdown">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            Held for you for <strong className="tabular-nums">{mm}:{ss}</strong>
          </p>
          <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-line-strong bg-surface-raised p-4" data-testid="payment-simulator">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4" aria-hidden="true" /> Development payment simulator
            </p>
            <p className="text-xs text-fg-muted">No real money is charged. In production this step is the Razorpay checkout (UPI, cards, netbanking), and the booking is confirmed only after the server verifies the payment.</p>
            <Button size="lg" loading={pay.isPending && pay.variables === "success"} disabled={pay.isPending} onClick={() => pay.mutate("success")}>
              Pay {inrPaise(b.pendingPayment.amountPaise)} (simulate success)
            </Button>
            <Button variant="secondary" disabled={pay.isPending} loading={pay.isPending && pay.variables === "failure"} onClick={() => pay.mutate("failure")}>
              Simulate payment failure
            </Button>
            {pay.isError ? (
              <p role="alert" className="text-sm text-danger">
                {pay.error.message}
              </p>
            ) : null}
          </div>
          <Link href={`/trips/${reference}`} className="text-sm text-fg-muted underline underline-offset-4">
            Pay later from My Trips
          </Link>
        </section>
      </div>
    </div>
  );
}
