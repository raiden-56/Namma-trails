"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CloudRain, ShieldCheck, Tag, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { market, traveler, type BookingRequest, type ServiceDetail } from "@/lib/api/marketplace";
import { formatInrFromPaise, todayInIndia } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { GuestStepper } from "@/components/ui/DateFields";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/States";
import { useMe } from "@/features/auth/session";
import { AVAILABILITY_REASON, addDaysLocal, fmtTime, istIso, tomorrowInIndia } from "./format";
import { PriceLines } from "./PriceLines";

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const TIME_OPTIONS = TIMES.map((time) => ({ value: time, label: time }));

function SlotPicker({ slug, date, value, onChange }: { slug: string; date: string; value: string | null; onChange: (id: string | null) => void }) {
  const slots = useQuery({ queryKey: ["slots", slug, date], queryFn: () => market.slots(slug, date), refetchInterval: 30_000 });
  const list = slots.data?.data ?? [];
  useEffect(() => {
    // Drop a selection that no longer exists on the newly chosen date.
    if (value && slots.data && !list.some((s) => s.id === value)) onChange(null);
  }, [slots.data, list, value, onChange]);

  if (slots.isPending) return <Skeleton className="h-16" />;
  if (slots.isError) return <p className="text-sm text-danger">{slots.error.message}</p>;
  if (list.length === 0) return <p className="rounded-md bg-surface-sunken p-3 text-sm text-fg-muted">No departures on this date. Try another day.</p>;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Departure</legend>
      <div className="grid grid-cols-3 gap-2">
        {list.map((s) => {
          const weather = s.status === "weather_hold";
          const disabled = !s.bookable || s.remaining <= 0;
          const checked = value === s.id;
          return (
            <label
              key={s.id}
              className={cn(
                "flex cursor-pointer flex-col items-center rounded-md border px-2 py-2 text-center has-focus-visible:outline-2 has-focus-visible:outline-accent-text",
                checked ? "border-fg bg-fg text-surface" : "border-line-strong hover:border-fg",
                disabled && "cursor-not-allowed opacity-50 hover:border-line-strong",
              )}
            >
              <input type="radio" name="slot" className="sr-only" value={s.id} checked={checked} disabled={disabled} onChange={() => onChange(s.id)} />
              <span className="text-sm font-semibold tabular-nums">{fmtTime(s.startsAt)}</span>
              <span className={cn("flex items-center gap-1 text-xs", checked ? "text-surface/80" : "text-fg-muted")}>
                {weather ? (
                  <>
                    <CloudRain className="size-3" aria-hidden="true" /> Weather hold
                  </>
                ) : s.remaining <= 0 ? (
                  "Full"
                ) : !s.bookable ? (
                  "Closed"
                ) : (
                  `${s.remaining} left`
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Booking widget. Every price and availability answer comes from the server. */
export function BookingPanel({ service }: { service: ServiceDetail }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const model = service.category.bookingModel;
  const tomorrow = tomorrowInIndia();
  const today = todayInIndia();

  const [date, setDate] = useState(tomorrow);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [optionId, setOptionId] = useState(service.options[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(tomorrow);
  const [checkOut, setCheckOut] = useState(addDaysLocal(tomorrow, 1));
  const [pickupDate, setPickupDate] = useState(tomorrow);
  const [pickupTime, setPickupTime] = useState("09:00");
  const [returnDate, setReturnDate] = useState(addDaysLocal(tomorrow, 1));
  const [returnTime, setReturnTime] = useState("09:00");
  const [startTime, setStartTime] = useState("09:00");
  const [routeId, setRouteId] = useState(service.routes[0]?.id ?? "");
  const [units, setUnits] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>();
  const [requests, setRequests] = useState("");

  const request: BookingRequest | null = useMemo(() => {
    const base = { serviceSlug: service.slug, ...(coupon ? { couponCode: coupon } : {}) };
    switch (model) {
      case "slot_capacity":
      case "package":
        return slotId ? { ...base, slotId, adults, children, ...(service.priceUnitLabel === "per boat" ? { mode: "private" as const } : {}) } : null;
      case "nightly_inventory":
        return optionId && checkOut > checkIn ? { ...base, inventoryItemId: optionId, checkIn, checkOut, units, adults, children } : null;
      case "time_range_rental": {
        const pickupAt = istIso(pickupDate, pickupTime);
        const returnAt = istIso(returnDate, returnTime);
        return optionId && returnAt > pickupAt ? { ...base, inventoryItemId: optionId, pickupAt, returnAt, units, adults: 1 } : null;
      }
      case "assigned_trip":
        return routeId ? { ...base, routeId, date, startTime, adults } : null;
      case "assigned_person":
        return { ...base, date, startTime, adults };
    }
  }, [model, service.slug, service.priceUnitLabel, coupon, slotId, adults, children, optionId, checkIn, checkOut, units, pickupDate, pickupTime, returnDate, returnTime, routeId, date, startTime]);

  const debounced = useDebounced(request);
  const quote = useQuery({
    queryKey: ["quote", debounced],
    queryFn: () => market.quote(debounced!),
    enabled: Boolean(debounced),
    retry: false,
    refetchInterval: 60_000,
  });
  const couponError = quote.error instanceof ApiError && quote.error.code.startsWith("COUPON") ? quote.error.message : null;
  const q = quote.data?.data;
  const available = q?.availability.available ?? false;
  const isRequest = service.confirmationPolicy === "request";

  const book = useMutation({
    mutationFn: () =>
      traveler.book(
        {
          ...request!,
          guests: me.data?.fullName ? [{ fullName: me.data.fullName, ...(me.data.phone ? { phone: me.data.phone } : {}) }] : undefined,
          ...(requests.trim() ? { specialRequests: requests.trim() } : {}),
        },
        crypto.randomUUID(),
      ),
    onSuccess: ({ data }) => {
      router.push(data.payment ? `/checkout/${data.reference}` : `/trips/${data.reference}?requested=1`);
    },
  });

  function onBook() {
    if (me.isError || !me.data) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    book.mutate();
  }

  // Room types or vehicles, with the price shown on the right of each row.
  const optionChoices = service.options.map((o) => ({
    value: o.id,
    label: o.name,
    ...(o.pricePaise !== null ? { detail: `${formatInrFromPaise(o.pricePaise)} ${o.priceUnitLabel ?? ""}`.trim() } : {}),
  }));

  const party = model === "nightly_inventory" ? `Guests (rooms hold up to ${service.options.find((o) => o.id === optionId)?.capacity ?? "?"} each)` : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-5 shadow-card" data-testid="booking-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p>
          {service.fromPricePaise !== null ? (
            <>
              <span className="text-sm text-fg-muted">From </span>
              <span className="text-xl font-semibold tabular-nums">{formatInrFromPaise(service.fromPricePaise)}</span>
              <span className="text-sm text-fg-muted"> {service.priceUnitLabel}</span>
            </>
          ) : (
            <span className="font-semibold">Check prices</span>
          )}
        </p>
        <span className={cn("text-xs font-semibold", isRequest ? "text-info" : "text-success")}>{isRequest ? "Partner confirms" : "Instant confirmation"}</span>
      </div>

      {(model === "slot_capacity" || model === "package") && (
        <>
          <Field id="bk-date" label="Date">
            <DatePicker min={today} value={date} onValueChange={setDate} />
          </Field>
          <SlotPicker slug={service.slug} date={date} value={slotId} onChange={setSlotId} />
        </>
      )}

      {model === "nightly_inventory" && (
        <>
          <Field id="bk-room" label="Room type">
            <Select value={optionId} onValueChange={setOptionId} options={optionChoices} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="bk-in" label="Check-in">
              <DatePicker
                min={today}
                value={checkIn}
                rangeStart={checkIn}
                rangeEnd={checkOut}
                onValueChange={(v) => {
                  setCheckIn(v);
                  if (checkOut <= v) setCheckOut(addDaysLocal(v, 1));
                }}
              />
            </Field>
            <Field id="bk-out" label="Check-out">
              <DatePicker min={addDaysLocal(checkIn, 1)} value={checkOut} rangeStart={checkIn} rangeEnd={checkOut} onValueChange={setCheckOut} />
            </Field>
          </div>
          <GuestStepper label="Rooms" value={units} onChange={setUnits} min={1} max={service.options.find((o) => o.id === optionId)?.units ?? 5} />
        </>
      )}

      {model === "time_range_rental" && (
        <>
          <Field id="bk-vehicle" label="Vehicle">
            <Select value={optionId} onValueChange={setOptionId} options={optionChoices} />
          </Field>
          {(() => {
            const deposit = service.options.find((o) => o.id === optionId)?.depositPaise;
            return deposit ? <p className="text-xs text-fg-muted">Refundable deposit {formatInrFromPaise(deposit)} per vehicle, returned when you drop it off.</p> : null;
          })()}
          <div className="grid grid-cols-2 gap-3">
            <Field id="bk-pd" label="Pickup date">
              <DatePicker
                min={today}
                value={pickupDate}
                rangeStart={pickupDate}
                rangeEnd={returnDate}
                onValueChange={(v) => {
                  setPickupDate(v);
                  if (returnDate < v) setReturnDate(addDaysLocal(v, 1));
                }}
              />
            </Field>
            <Field id="bk-pt" label="Pickup time">
              <Select value={pickupTime} onValueChange={setPickupTime} options={TIME_OPTIONS} />
            </Field>
            <Field id="bk-rd" label="Return date">
              <DatePicker min={pickupDate} value={returnDate} rangeStart={pickupDate} rangeEnd={returnDate} onValueChange={setReturnDate} />
            </Field>
            <Field id="bk-rt" label="Return time">
              <Select value={returnTime} onValueChange={setReturnTime} options={TIME_OPTIONS} />
            </Field>
          </div>
          <GuestStepper label="Vehicles" value={units} onChange={setUnits} min={1} max={service.options.find((o) => o.id === optionId)?.units ?? 3} />
        </>
      )}

      {model === "assigned_trip" && (
        <Field id="bk-route" label="Route">
          <Select
            value={routeId}
            onValueChange={setRouteId}
            options={service.routes.map((r) => ({ value: r.id, label: r.name, ...(r.farePaise !== null ? { detail: formatInrFromPaise(r.farePaise) } : {}) }))}
          />
        </Field>
      )}

      {(model === "assigned_trip" || model === "assigned_person") && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="bk-day" label="Date">
            <DatePicker min={today} value={date} onValueChange={setDate} />
          </Field>
          <Field id="bk-time" label={model === "assigned_trip" ? "Pickup time" : "Start time"}>
            <Select value={startTime} onValueChange={setStartTime} options={TIME_OPTIONS} />
          </Field>
        </div>
      )}

      {model !== "time_range_rental" && (
        <div className="divide-y divide-line">
          {party ? <p className="pb-1 text-xs text-fg-muted">{party}</p> : null}
          <GuestStepper
            label={model === "assigned_trip" ? "Passengers" : model === "assigned_person" ? "Group size" : "Adults"}
            value={adults}
            onChange={setAdults}
            min={1}
            max={service.maxParticipants ?? 12}
          />
          {model === "slot_capacity" || model === "package" || model === "nightly_inventory" ? (
            <GuestStepper label="Children" description={service.minAge ? `Minimum age ${service.minAge}` : "Under 12"} value={children} onChange={setChildren} min={0} max={8} />
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {coupon ? (
          <p className="flex items-center justify-between gap-2 rounded-md bg-success/10 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5">
              <Tag className="size-4" aria-hidden="true" /> Coupon <strong>{coupon}</strong>
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold underline"
              onClick={() => {
                setCoupon(undefined);
                setCouponInput("");
              }}
            >
              <X className="size-3" aria-hidden="true" /> Remove
            </button>
          </p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (couponInput.trim()) setCoupon(couponInput.trim().toUpperCase());
            }}
          >
            <Input aria-label="Coupon code" placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="h-10" />
            <Button type="submit" variant="secondary" size="sm" disabled={!couponInput.trim()}>
              Apply
            </Button>
          </form>
        )}
        {couponError ? <p role="alert" className="text-xs text-danger">{couponError}</p> : null}
      </div>

      <div aria-live="polite" className="min-h-16">
        {!request ? (
          <p className="text-sm text-fg-muted">{model === "slot_capacity" || model === "package" ? "Choose a departure to see the price." : "Complete your choices to see the price."}</p>
        ) : quote.isFetching && !q ? (
          <Skeleton className="h-24" />
        ) : quote.isError && !couponError ? (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {quote.error.message}
          </p>
        ) : q ? (
          <div className={cn("flex flex-col gap-3", quote.isFetching && "opacity-60")}>
            {!available ? (
              <p role="alert" className="rounded-md bg-warning/15 p-3 text-sm">
                {AVAILABILITY_REASON[q.availability.reason ?? ""] ?? "Not available for this selection."}
              </p>
            ) : null}
            <PriceLines lines={q.quote.lines} total={q.quote.total} totalLabel={isRequest ? "Total (pay after the partner confirms)" : "Total to pay"} />
          </div>
        ) : null}
      </div>

      {request ? (
        <Field id="bk-notes" label="Requests for the partner (optional)">
          <Input value={requests} onChange={(e) => setRequests(e.target.value)} maxLength={300} placeholder="e.g. early check-in, vegetarian breakfast" />
        </Field>
      ) : null}

      {book.isError ? (
        <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {book.error.message}
        </p>
      ) : null}

      <Button size="lg" onClick={onBook} disabled={!request || !q || !available || quote.isFetching} loading={book.isPending}>
        {isRequest ? "Request booking" : "Book now"}
      </Button>
      <p className="flex items-start gap-1.5 text-xs text-fg-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {isRequest
          ? "Nothing is charged now. You pay only after the partner confirms."
          : service.cancellationPolicy
            ? `${service.cancellationPolicy.name} cancellation: ${service.cancellationPolicy.summary}`
            : "Free cancellation terms are shown before you pay."}
      </p>
    </div>
  );
}
