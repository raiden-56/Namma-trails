import {
  type AvailabilityResult,
  type BookingActor,
  type BookingStatus,
  type CancellationPolicy,
  type ConfirmationPolicy,
  type Quote,
  type QuoteRequest,
  DomainError,
  addDays,
  assertTransition,
  buildQuote,
  checkBookingWindow,
  computeRefund,
  computeSettlement,
  datesTouched,
  eachNight,
  freeResources,
  istDateOf,
  istInstant,
  nightlyAvailability,
  rentalAvailability,
  resolveCommissionRule,
  slotAvailability,
} from "@kt/domain";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { type PaymentGateway, couponFromRow, pricingConfigFor, reference, toLocalDateString } from "./support.js";

type Tx = Prisma.TransactionClient;

export interface BookingRequest {
  serviceSlug: string;
  /** Room type, vehicle model or boat. Required for stays and rentals. */
  inventoryItemId?: string;
  /** Departure / session (boats, adventure, experiences). */
  slotId?: string;
  mode?: "shared" | "private";
  /** Service date for taxis and guides. */
  date?: string;
  /** "HH:mm" (IST) for taxis and guides. */
  startTime?: string;
  checkIn?: string;
  checkOut?: string;
  pickupAt?: string;
  returnAt?: string;
  units?: number;
  adults?: number;
  children?: number;
  /** Taxi route defined by the operator (distance is the operator's, never invented). */
  routeId?: string;
  couponCode?: string;
}

export interface GuestInput {
  fullName: string;
  phone?: string;
  age?: number;
}

interface Route {
  id: string;
  name: string;
  km: number;
  durationMinutes?: number;
}

const SERVICE_INCLUDE = {
  category: true,
  destination: true,
  provider: true,
  cancellationPolicy: true,
  blackoutDates: true,
  inventoryItems: { where: { isActive: true }, orderBy: { name: "asc" } },
  pricePlans: { where: { isActive: true }, include: { seasonalRules: true } },
} satisfies Prisma.ServiceInclude;

type LoadedService = Prisma.ServiceGetPayload<{ include: typeof SERVICE_INCLUDE }>;

interface Resolved {
  model: string;
  plan: LoadedService["pricePlans"][number];
  inventoryItemId: string | null;
  slotId: string | null;
  startsAt: Date;
  endsAt: Date;
  quoteRequest: QuoteRequest;
  party: number;
  units: number;
  nights: string[];
  route: Route | null;
}

const HOLD_MINUTES = 15;
const PAYMENT_WINDOW_HOURS = 24;
const NOT_RELEASED = { releasedAt: null } as const;
const DEFAULT_POLICY: CancellationPolicy = { tiers: [{ minHoursBeforeStart: 24, refundBps: 10_000 }, { minHoursBeforeStart: 0, refundBps: 0 }], platformFeeRefundable: false };

export class BookingEngine {
  /** Injectable clock: the demo seed replays history by moving it into the past. */
  now: () => Date = () => new Date();

  constructor(
    private readonly db: PrismaClient,
    private readonly gateway: PaymentGateway,
  ) {}

  /* ───────────────────────────── loading & resolving ───────────────────────────── */

  async loadService(slug: string, tx: Tx | PrismaClient = this.db): Promise<LoadedService> {
    const s = await tx.service.findUnique({ where: { slug }, include: SERVICE_INCLUDE });
    if (!s || s.deletedAt) throw new DomainError("SERVICE_NOT_FOUND", "This service is not available");
    return s;
  }

  /** Same publish gate as search: a service is bookable only if published, its provider approved and its destination active. */
  assertBookable(s: LoadedService) {
    if (s.status !== "published" || s.provider.status !== "approved" || s.provider.deletedAt || s.destination.status !== "active") {
      throw new DomainError("NOT_BOOKABLE", "This service is not open for bookings right now");
    }
  }

  private planFor(s: LoadedService, inventoryItemId: string | null) {
    const plan = s.pricePlans.find((p) => p.inventoryItemId === inventoryItemId) ?? s.pricePlans.find((p) => p.inventoryItemId === null) ?? s.pricePlans[0];
    if (!plan) throw new DomainError("NO_PRICE", "This service has no price set");
    return plan;
  }

  async resolve(s: LoadedService, req: BookingRequest, tx: Tx | PrismaClient = this.db): Promise<Resolved> {
    const model = s.category.bookingModel;
    const adults = Math.max(0, req.adults ?? 1);
    const children = Math.max(0, req.children ?? 0);
    const party = adults + children;
    const units = Math.max(1, req.units ?? 1);
    const base = { adults, children, units };

    switch (model) {
      case "slot_capacity":
      case "package": {
        if (!req.slotId) throw new DomainError("SLOT_REQUIRED", "Choose a departure time");
        const slot = await tx.availabilitySlot.findUnique({ where: { id: req.slotId }, include: { inventoryItem: true } });
        if (!slot || slot.inventoryItem.serviceId !== s.id) throw new DomainError("SLOT_NOT_FOUND", "That departure is not available");
        const plan = this.planFor(s, slot.inventoryItemId);
        return {
          model,
          plan,
          inventoryItemId: slot.inventoryItemId,
          slotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          quoteRequest: { ...base, units: plan.model === "per_unit" ? 1 : units, date: toLocalDateString(slot.date) },
          party,
          units,
          nights: [],
          route: null,
        };
      }
      case "nightly_inventory": {
        if (!req.inventoryItemId) throw new DomainError("ROOM_REQUIRED", "Choose a room type");
        if (!req.checkIn || !req.checkOut) throw new DomainError("DATES_REQUIRED", "Choose check-in and check-out dates");
        const item = s.inventoryItems.find((i) => i.id === req.inventoryItemId);
        if (!item) throw new DomainError("ROOM_NOT_FOUND", "That room type is not available");
        const nights = eachNight(req.checkIn, req.checkOut);
        const attrs = (s.attributes ?? {}) as { checkInTime?: string; checkOutTime?: string };
        if (party > item.capacity * units + units) throw new DomainError("OCCUPANCY_EXCEEDED", "Too many guests for the selected rooms");
        return {
          model,
          plan: this.planFor(s, item.id),
          inventoryItemId: item.id,
          slotId: null,
          startsAt: istInstant(req.checkIn, attrs.checkInTime ?? "14:00"),
          endsAt: istInstant(req.checkOut, attrs.checkOutTime ?? "11:00"),
          quoteRequest: { ...base, checkIn: req.checkIn, checkOut: req.checkOut },
          party,
          units,
          nights,
          route: null,
        };
      }
      case "time_range_rental": {
        if (!req.inventoryItemId) throw new DomainError("VEHICLE_REQUIRED", "Choose a vehicle");
        if (!req.pickupAt || !req.returnAt) throw new DomainError("DATES_REQUIRED", "Choose pickup and return times");
        const item = s.inventoryItems.find((i) => i.id === req.inventoryItemId);
        if (!item) throw new DomainError("VEHICLE_NOT_FOUND", "That vehicle is not available");
        const pickupAt = new Date(req.pickupAt);
        const returnAt = new Date(req.returnAt);
        if (!(returnAt > pickupAt)) throw new DomainError("INVALID_DATE_RANGE", "Return must be after pickup");
        return {
          model,
          plan: this.planFor(s, item.id),
          inventoryItemId: item.id,
          slotId: null,
          startsAt: pickupAt,
          endsAt: returnAt,
          quoteRequest: { ...base, pickupAt, returnAt },
          party,
          units,
          nights: [],
          route: null,
        };
      }
      case "assigned_trip": {
        if (!req.date || !req.startTime) throw new DomainError("DATES_REQUIRED", "Choose a pickup date and time");
        const routes = ((s.attributes ?? {}) as { routes?: Route[] }).routes ?? [];
        const route = routes.find((r) => r.id === req.routeId);
        if (!route) throw new DomainError("ROUTE_REQUIRED", "Choose a route");
        const startsAt = istInstant(req.date, req.startTime);
        return {
          model,
          plan: this.planFor(s, null),
          inventoryItemId: null,
          slotId: null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + (route.durationMinutes ?? 60) * 60_000),
          quoteRequest: { ...base, units: 1, date: req.date, distanceKm: route.km },
          party,
          units: 1,
          nights: [],
          route,
        };
      }
      case "assigned_person": {
        if (!req.date || !req.startTime) throw new DomainError("DATES_REQUIRED", "Choose a date and start time");
        const startsAt = istInstant(req.date, req.startTime);
        return {
          model,
          plan: this.planFor(s, null),
          inventoryItemId: null,
          slotId: null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + (s.durationMinutes ?? 240) * 60_000),
          quoteRequest: { ...base, units: 1, date: req.date },
          party,
          units: 1,
          nights: [],
          route: null,
        };
      }
      default:
        throw new DomainError("UNSUPPORTED", `Booking model ${model} is not supported`);
    }
  }

  /* ───────────────────────────── availability ───────────────────────────── */

  /** Evaluates availability. With `lock`, takes row locks so the caller can safely insert holds in the same transaction. */
  async availability(tx: Tx | PrismaClient, s: LoadedService, r: Resolved, req: BookingRequest, lock: boolean): Promise<AvailabilityResult & { resourceId?: string }> {
    const now = this.now();
    const window = checkBookingWindow(
      { minLeadMinutes: s.minLeadMinutes, maxAdvanceDays: s.maxAdvanceDays, blackoutDates: s.blackoutDates.map((b) => toLocalDateString(b.date)) },
      r.startsAt,
      now,
      datesTouched(s.category.bookingModel, { ...(req.date ? { date: req.date } : {}), ...(req.checkIn ? { checkIn: req.checkIn } : {}), ...(req.checkOut ? { checkOut: req.checkOut } : {}), start: r.startsAt, end: r.endsAt }),
    );
    if (window) return window;
    if (r.party > 0 && s.maxParticipants && r.party > s.maxParticipants) return { available: false, remaining: 0, reason: "insufficient_capacity" };
    const live = { OR: [{ kind: "committed" as const }, { expiresAt: { gt: now } }], ...NOT_RELEASED };

    if (r.slotId) {
      if (lock) await (tx as Tx).$queryRaw`SELECT id FROM availability_slots WHERE id = ${r.slotId}::uuid FOR UPDATE`;
      const slot = await tx.availabilitySlot.findUniqueOrThrow({ where: { id: r.slotId } });
      // Expired holds still counted in `held` are excluded by recomputing from live reservations.
      const held = await tx.inventoryReservation.aggregate({ _sum: { units: true }, where: { slotId: slot.id, kind: "hold", expiresAt: { gt: now }, ...NOT_RELEASED } });
      return slotAvailability(
        { capacity: slot.capacity, committed: slot.committed, held: held._sum.units ?? 0, status: slot.status, privatelyBooked: slot.privatelyBooked },
        { seats: req.mode === "private" ? slot.capacity : r.party, mode: req.mode ?? "shared" },
      );
    }

    if (r.model === "nightly_inventory" && r.inventoryItemId) {
      if (lock) await (tx as Tx).$queryRaw`SELECT id FROM inventory_items WHERE id = ${r.inventoryItemId}::uuid FOR UPDATE`;
      const item = s.inventoryItems.find((i) => i.id === r.inventoryItemId)!;
      const nightDates = r.nights.map((n) => new Date(`${n}T00:00:00Z`));
      // Sequential on purpose: a transaction runs on one connection.
      const usage = await tx.inventoryReservation.groupBy({ by: ["nightDate"], _sum: { units: true }, where: { inventoryItemId: item.id, nightDate: { in: nightDates }, ...live } });
      const overrides = await tx.inventoryDayOverride.findMany({ where: { inventoryItemId: item.id, date: { in: nightDates } } });
      return nightlyAvailability(
        {
          totalUnits: item.totalUnits,
          unitOverrides: Object.fromEntries(overrides.filter((o) => o.totalUnits !== null).map((o) => [toLocalDateString(o.date), o.totalUnits!])),
          usedByDate: Object.fromEntries(usage.map((u) => [toLocalDateString(u.nightDate!), u._sum.units ?? 0])),
          closedDates: overrides.filter((o) => o.closed).map((o) => toLocalDateString(o.date)),
        },
        { checkIn: r.nights[0]!, checkOut: addDays(r.nights.at(-1)!, 1), units: r.units },
      );
    }

    if (r.model === "time_range_rental" && r.inventoryItemId) {
      if (lock) await (tx as Tx).$queryRaw`SELECT id FROM inventory_items WHERE id = ${r.inventoryItemId}::uuid FOR UPDATE`;
      const item = s.inventoryItems.find((i) => i.id === r.inventoryItemId)!;
      const pad = item.turnaroundMins * 60_000;
      const reservations = await tx.inventoryReservation.findMany({
        where: { inventoryItemId: item.id, startsAt: { lt: new Date(r.endsAt.getTime() + pad) }, endsAt: { gt: new Date(r.startsAt.getTime() - pad) }, ...live },
        select: { startsAt: true, endsAt: true, units: true },
      });
      const intervals = reservations.flatMap((x) => Array.from({ length: x.units }, () => ({ start: x.startsAt!, end: x.endsAt! })));
      return rentalAvailability({ totalUnits: item.totalUnits, turnaroundMinutes: item.turnaroundMins, reservations: intervals }, { pickupAt: r.startsAt, returnAt: r.endsAt, units: r.units });
    }

    // assigned_trip / assigned_person: a specific cab or guide must be free. The exclusion constraint is the final guard.
    const resources = s.inventoryItems;
    if (lock) for (const res of resources) await (tx as Tx).$queryRaw`SELECT id FROM inventory_items WHERE id = ${res.id}::uuid FOR UPDATE`;
    const busy = await tx.bookingAssignment.findMany({
      where: { inventoryItemId: { in: resources.map((x) => x.id) }, startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt }, ...NOT_RELEASED },
      select: { inventoryItemId: true, startsAt: true, endsAt: true },
    });
    const free = freeResources(
      resources.map((x) => ({
        id: x.id,
        active: x.isActive,
        capacity: x.capacity,
        tags: x.tags,
        busy: busy.filter((b) => b.inventoryItemId === x.id).map((b) => ({ start: b.startsAt, end: b.endsAt })),
      })),
      { start: r.startsAt, end: r.endsAt, partySize: Math.max(1, r.party) },
    );
    if (free.length === 0) return { available: false, remaining: 0, reason: "no_resource_free" };
    return { available: true, remaining: free.length - 1, resourceId: free[0]!.id };
  }

  /* ───────────────────────────── pricing ───────────────────────────── */

  private async settings(tx: Tx | PrismaClient) {
    const rows = await tx.systemSetting.findMany({ where: { key: { in: ["pricing.platform_fee", "finance.commission_tax_bps", "finance.withholdings"] } } });
    const get = <T>(key: string, fallback: T): T => (rows.find((r) => r.key === key)?.value as T | undefined) ?? fallback;
    return {
      platformFee: get<{ label: string; flatAmount?: number; rateBps?: number; taxRateBps?: number } | null>("pricing.platform_fee", null),
      commissionTaxBps: get<number>("finance.commission_tax_bps", 0),
      withholdings: get<{ code: string; label: string; rateBps: number; base: "service_value" | "gross_including_tax" }[]>("finance.withholdings", []),
    };
  }

  private async price(tx: Tx | PrismaClient, s: LoadedService, r: Resolved, couponCode?: string): Promise<{ quote: Quote; couponId: string | null }> {
    const now = this.now();
    const taxRules = await tx.taxRule.findMany({ where: { categoryId: s.categoryId } });
    const settings = await this.settings(tx);
    const coupon = await (couponCode
        ? tx.coupon.findFirst({
            where: {
              code: couponCode.trim(),
              isActive: true,
              validFrom: { lte: now },
              validTo: { gt: now },
              AND: [{ OR: [{ providerId: null }, { providerId: s.providerId }] }, { OR: [{ categoryKey: null }, { categoryKey: s.category.key }] }],
            },
          })
        : Promise.resolve(null));
    if (couponCode && !coupon) throw new DomainError("COUPON_INVALID", "That coupon code is not valid for this booking");
    if (coupon && coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) throw new DomainError("COUPON_EXHAUSTED", "This coupon has been fully used");
    const quote = buildQuote(pricingConfigFor(r.plan, taxRules, now), r.quoteRequest, {
      ...(coupon ? { coupon: couponFromRow(coupon) } : {}),
      ...(settings.platformFee ? { platformFee: settings.platformFee } : {}),
    });
    return { quote, couponId: coupon?.id ?? null };
  }

  /** Read-only quote + availability, used by the booking panel. Always recomputed on the server. */
  async quote(req: BookingRequest) {
    this.expireHolds().catch(() => undefined);
    const s = await this.loadService(req.serviceSlug);
    this.assertBookable(s);
    const r = await this.resolve(s, req);
    const availability = await this.availability(this.db, s, r, req, false);
    const priced = await this.price(this.db, s, r, req.couponCode);
    const { resourceId: _ignored, ...publicAvailability } = availability;
    return {
      service: { slug: s.slug, title: s.title, confirmationPolicy: s.confirmationPolicy },
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      route: r.route,
      availability: publicAvailability,
      quote: priced.quote,
    };
  }

  /* ───────────────────────────── lifecycle ───────────────────────────── */

  private async transition(tx: Tx, booking: { id: string; status: BookingStatus; version: number; confirmationPolicy: ConfirmationPolicy }, to: BookingStatus, actor: BookingActor, actorId: string | null, note?: string, data: Prisma.BookingUpdateManyMutationInput = {}) {
    const rule = assertTransition(booking.status, to, actor, booking.confirmationPolicy);
    const { count } = await tx.booking.updateMany({ where: { id: booking.id, version: booking.version }, data: { ...data, status: to, version: { increment: 1 } } });
    if (count !== 1) throw new DomainError("BOOKING_CONCURRENT_UPDATE", "This booking was just updated. Refresh and try again.");
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, fromStatus: booking.status, toStatus: to, event: rule.event, actorType: actor, actorId, note: note ?? null, createdAt: this.now() } });
    booking.status = to;
    booking.version += 1;
  }

  /** Creates a trip with one booking, holding inventory atomically. Instant bookings get a payment order; request bookings wait for the provider. */
  async create(req: BookingRequest, travelerId: string, extra: { guests?: GuestInput[]; specialRequests?: string; tripId?: string } = {}) {
    const now = this.now();
    return this.db.$transaction(
      async (tx) => {
        const s = await this.loadService(req.serviceSlug, tx);
        this.assertBookable(s);
        const r = await this.resolve(s, req, tx);
        const availability = await this.availability(tx, s, r, req, true);
        if (!availability.available) {
          throw new DomainError("INVENTORY_UNAVAILABLE", "Sorry, that is no longer available. Try another date or time.", { reason: availability.reason ?? null });
        }
        const { quote, couponId } = await this.price(tx, s, r, req.couponCode);
        const policy: CancellationPolicy = s.cancellationPolicy
          ? { tiers: s.cancellationPolicy.tiers as CancellationPolicy["tiers"], platformFeeRefundable: s.cancellationPolicy.platformFeeRefundable }
          : DEFAULT_POLICY;
        const confirmationPolicy = s.confirmationPolicy;
        const holdUntil =
          confirmationPolicy === "request" ? new Date(now.getTime() + s.providerResponseMins * 60_000) : new Date(now.getTime() + HOLD_MINUTES * 60_000);

        const trip =
          (extra.tripId && (await tx.trip.findFirst({ where: { id: extra.tripId, userId: travelerId } }))) ||
          (await tx.trip.create({
            data: { reference: reference("TR"), userId: travelerId, title: `${s.destination.name} trip`, destinationId: s.destinationId, startDate: r.startsAt, endDate: r.endsAt, status: "planning", createdAt: now },
          }));

        const created = await tx.booking.create({
          data: {
            reference: reference("BK"),
            tripId: trip.id,
            travelerId,
            providerId: s.providerId,
            serviceId: s.id,
            pricePlanId: r.plan.id,
            status: "draft",
            confirmationPolicy,
            request: { ...req, ...(r.route ? { route: r.route } : {}) } as unknown as Prisma.InputJsonValue,
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            units: r.units,
            adults: req.adults ?? 1,
            children: req.children ?? 0,
            quote: quote as unknown as Prisma.InputJsonValue,
            serviceSubtotal: quote.serviceSubtotal,
            discount: quote.discount,
            discountFundedBy: quote.discountFundedBy,
            taxableValue: quote.taxableValue,
            serviceTax: quote.serviceTax,
            platformFee: quote.platformFee,
            platformFeeTax: quote.platformFeeTax,
            deposit: quote.deposit,
            total: quote.total,
            cancellationPolicy: policy as unknown as Prisma.InputJsonValue,
            holdExpiresAt: holdUntil,
            ...(confirmationPolicy === "request" ? { providerRespondBy: holdUntil } : { paymentDueBy: holdUntil }),
            specialRequests: extra.specialRequests ?? null,
            createdAt: now,
            guests: extra.guests?.length ? { create: extra.guests.map((g, i) => ({ fullName: g.fullName, phone: g.phone ?? null, age: g.age ?? null, isLead: i === 0 })) } : undefined,
          },
        });
        const booking = { id: created.id, status: created.status as BookingStatus, version: created.version, confirmationPolicy };
        await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, toStatus: "draft", event: "booking_created", actorType: "traveler", actorId: travelerId, createdAt: now } });
        await this.transition(tx, booking, "pending_availability", "traveler", travelerId);

        // Hold inventory.
        if (r.slotId) {
          const seats = req.mode === "private" ? (await tx.availabilitySlot.findUniqueOrThrow({ where: { id: r.slotId } })).capacity : r.party;
          await tx.inventoryReservation.create({ data: { bookingId: booking.id, inventoryItemId: r.inventoryItemId!, slotId: r.slotId, units: seats, kind: "hold", expiresAt: holdUntil, createdAt: now } });
          await tx.availabilitySlot.update({ where: { id: r.slotId }, data: { held: { increment: seats }, ...(req.mode === "private" ? { privatelyBooked: true } : {}) } });
        } else if (r.model === "nightly_inventory") {
          await tx.inventoryReservation.createMany({
            data: r.nights.map((n) => ({ bookingId: booking.id, inventoryItemId: r.inventoryItemId!, nightDate: new Date(`${n}T00:00:00Z`), units: r.units, kind: "hold" as const, expiresAt: holdUntil, createdAt: now })),
          });
        } else if (r.model === "time_range_rental") {
          await tx.inventoryReservation.create({ data: { bookingId: booking.id, inventoryItemId: r.inventoryItemId!, startsAt: r.startsAt, endsAt: r.endsAt, units: r.units, kind: "hold", expiresAt: holdUntil, createdAt: now } });
        } else if (availability.resourceId) {
          await tx.bookingAssignment.create({ data: { bookingId: booking.id, inventoryItemId: availability.resourceId, startsAt: r.startsAt, endsAt: r.endsAt, createdAt: now } });
        }

        if (couponId) {
          await tx.couponRedemption.create({ data: { couponId, userId: travelerId, bookingId: booking.id, discount: quote.discount, createdAt: now } });
          await tx.coupon.update({ where: { id: couponId }, data: { redeemedCount: { increment: 1 } } });
        }

        let payment: { id: string; gatewayOrderId: string; amount: number } | null = null;
        if (confirmationPolicy === "instant") {
          await this.transition(tx, booking, "awaiting_payment", "system", null);
          payment = await this.createPayment(tx, trip.id, [{ id: booking.id, total: quote.total }], `booking:${booking.id}`);
        } else {
          await this.transition(tx, booking, "awaiting_provider_confirmation", "system", null);
        }
        await tx.trip.update({ where: { id: trip.id }, data: { status: confirmationPolicy === "instant" ? "action_required" : "awaiting_providers" } });
        return { bookingId: booking.id, reference: created.reference, tripReference: trip.reference, status: booking.status, total: quote.total, payment, holdExpiresAt: holdUntil };
      },
      { timeout: 20_000 },
    );
  }

  private async createPayment(tx: Tx, tripId: string, bookings: { id: string; total: number }[], idempotencyKey: string) {
    const amount = bookings.reduce((a, b) => a + b.total, 0);
    const order = await this.gateway.createOrder(amount, idempotencyKey);
    const p = await tx.payment.create({
      data: {
        tripId,
        gateway: this.gateway.name,
        gatewayOrderId: order.orderId,
        amount,
        idempotencyKey,
        status: "created",
        createdAt: this.now(),
        allocations: { create: bookings.map((b) => ({ bookingId: b.id, amount: b.total })) },
      },
    });
    return { id: p.id, gatewayOrderId: p.gatewayOrderId, amount: p.amount };
  }

  /** Called only after the gateway verifies the payment (webhook / signature). Idempotent. */
  async confirmPayment(paymentId: string, gatewayPaymentId: string, method = "upi") {
    const now = this.now();
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: { include: { booking: { include: { service: { include: { category: true } } } } } } } });
      if (payment.status === "captured") return { status: "already_captured" as const };
      if (payment.status !== "created" && payment.status !== "authorized") throw new DomainError("PAYMENT_NOT_PENDING", "This payment can no longer be completed");
      await tx.payment.update({ where: { id: paymentId }, data: { status: "captured", gatewayPaymentId, method, capturedAt: now } });
      for (const a of payment.allocations) {
        const b = a.booking;
        const booking = { id: b.id, status: b.status as BookingStatus, version: b.version, confirmationPolicy: b.confirmationPolicy };
        if (b.status !== "awaiting_payment") {
          // Hold expired before the money arrived: refund this allocation in full rather than oversell.
          await this.refundAllocation(tx, payment.id, b.id, a.amount, "Hold expired before payment completed");
          continue;
        }
        await this.commit(tx, b.id);
        await this.transition(tx, booking, "confirmed", "system", null, "Payment verified", { confirmedAt: now, holdExpiresAt: null });
        await this.createSettlement(tx, b);
      }
      await this.refreshTrip(tx, payment.tripId);
      return { status: "captured" as const };
    });
  }

  async failPayment(paymentId: string, reason = "Payment was declined") {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: { include: { booking: true } } } });
      if (payment.status !== "created") return;
      await tx.payment.update({ where: { id: paymentId }, data: { status: "failed", failureReason: reason } });
      for (const a of payment.allocations) {
        const b = a.booking;
        if (b.status !== "awaiting_payment") continue;
        await this.release(tx, b.id);
        await this.transition(tx, { id: b.id, status: b.status, version: b.version, confirmationPolicy: b.confirmationPolicy }, "failed", "system", null, reason);
      }
      await this.refreshTrip(tx, payment.tripId);
    });
  }

  private async commit(tx: Tx, bookingId: string) {
    const holds = await tx.inventoryReservation.findMany({ where: { bookingId, kind: "hold", ...NOT_RELEASED } });
    for (const h of holds) {
      if (h.slotId) await tx.availabilitySlot.update({ where: { id: h.slotId }, data: { held: { decrement: h.units }, committed: { increment: h.units } } });
    }
    await tx.inventoryReservation.updateMany({ where: { bookingId, kind: "hold", ...NOT_RELEASED }, data: { kind: "committed", expiresAt: null } });
  }

  private async release(tx: Tx, bookingId: string) {
    const now = this.now();
    const live = await tx.inventoryReservation.findMany({ where: { bookingId, ...NOT_RELEASED } });
    for (const r of live) {
      if (r.slotId) {
        await tx.availabilitySlot.update({
          where: { id: r.slotId },
          data: r.kind === "hold" ? { held: { decrement: r.units }, privatelyBooked: false } : { committed: { decrement: r.units }, privatelyBooked: false },
        });
      }
    }
    await tx.inventoryReservation.updateMany({ where: { bookingId, ...NOT_RELEASED }, data: { releasedAt: now } });
    await tx.bookingAssignment.updateMany({ where: { bookingId, ...NOT_RELEASED }, data: { releasedAt: now } });
  }

  private async createSettlement(tx: Tx, b: { id: string; providerId: string; taxableValue: number; serviceTax: number; discount: number; discountFundedBy: "platform" | "provider" | null; endsAt: Date; service: { destinationId: string; category: { key: string; taxRemitter: "provider" | "platform" } } }) {
    const rules = await tx.commissionRule.findMany();
    const settings = await this.settings(tx);
    const rule = resolveCommissionRule(
      rules.map((x) => ({ id: x.id, providerId: x.providerId, categoryKey: x.categoryKey, destinationId: x.destinationId, rateBps: x.rateBps, priority: x.priority, validFrom: x.validFrom, validTo: x.validTo, ...(x.fixedAmount !== null ? { fixedAmount: x.fixedAmount } : {}) })),
      { providerId: b.providerId, categoryKey: b.service.category.key, destinationId: b.service.destinationId, at: this.now() },
    );
    const s = computeSettlement(
      { taxableValue: b.taxableValue, serviceTax: b.serviceTax, discount: b.discount, discountFundedBy: b.discountFundedBy },
      { rule, commissionTaxBps: settings.commissionTaxBps, serviceTaxRemittedBy: b.service.category.taxRemitter, withholdings: settings.withholdings },
    );
    await tx.bookingSettlement.create({
      data: {
        bookingId: b.id,
        commissionRuleId: s.commissionRuleId,
        providerServiceValue: s.providerServiceValue,
        commission: s.commission,
        commissionTax: s.commissionTax,
        withholdings: s.withholdings as unknown as Prisma.InputJsonValue,
        serviceTaxPassThrough: s.serviceTaxPassThrough,
        netPayout: s.netPayout,
        eligibleOn: new Date(`${addDays(istDateOf(b.endsAt), 3)}T00:00:00Z`),
        createdAt: this.now(),
      },
    });
  }

  private async refundAllocation(tx: Tx, paymentId: string, bookingId: string, amount: number, reason: string) {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const r = await this.gateway.refund(payment.gatewayPaymentId ?? payment.gatewayOrderId, amount);
    await tx.refund.create({
      data: { bookingId, paymentId, amount, computation: { reason, full: true }, initiatedBy: "platform", status: "succeeded", gatewayRefundId: r.refundId, reason, idempotencyKey: `auto:${bookingId}:${paymentId}`, createdAt: this.now() },
    });
  }

  async providerAccept(bookingId: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const booking = { id: b.id, status: b.status, version: b.version, confirmationPolicy: b.confirmationPolicy };
      const due = new Date(this.now().getTime() + PAYMENT_WINDOW_HOURS * 3_600_000);
      await this.transition(tx, booking, "awaiting_payment", "provider", actorId, "Accepted by partner", { paymentDueBy: due, holdExpiresAt: due });
      await tx.inventoryReservation.updateMany({ where: { bookingId, kind: "hold", ...NOT_RELEASED }, data: { expiresAt: due } });
      const payment = await this.createPayment(tx, b.tripId, [{ id: b.id, total: b.total }], `booking:${b.id}:accept`);
      await this.refreshTrip(tx, b.tripId);
      return { status: booking.status, payment };
    });
  }

  async providerReject(bookingId: string, actorId: string, reason: string) {
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      await this.release(tx, b.id);
      await this.transition(tx, { id: b.id, status: b.status, version: b.version, confirmationPolicy: b.confirmationPolicy }, "cancelled", "provider", actorId, reason, { cancelledAt: this.now(), cancellationReason: reason });
      await this.refreshTrip(tx, b.tripId);
    });
  }

  async markStarted(bookingId: string, actorId: string | null, actor: BookingActor = "provider") {
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      await this.transition(tx, { id: b.id, status: b.status, version: b.version, confirmationPolicy: b.confirmationPolicy }, "in_progress", actor, actorId);
      await this.refreshTrip(tx, b.tripId);
    });
  }

  async markCompleted(bookingId: string, actorId: string | null, actor: BookingActor = "provider") {
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      await this.transition(tx, { id: b.id, status: b.status, version: b.version, confirmationPolicy: b.confirmationPolicy }, "completed", actor, actorId, undefined, { completedAt: this.now() });
      await this.refreshTrip(tx, b.tripId);
    });
  }

  /** Refund preview using the booking's own policy snapshot. */
  refundPreview(b: { startsAt: Date; cancellationPolicy: unknown; taxableValue: number; serviceTax: number; platformFee: number; platformFeeTax: number; deposit: number; amountRefunded: number }, initiatedBy: "traveler" | "provider" | "platform" | "weather" = "traveler") {
    return computeRefund({
      policy: (b.cancellationPolicy as CancellationPolicy) ?? DEFAULT_POLICY,
      paid: { taxableValue: b.taxableValue, serviceTax: b.serviceTax, platformFee: b.platformFee, platformFeeTax: b.platformFeeTax, deposit: b.deposit },
      serviceStartAt: b.startsAt,
      cancelledAt: this.now(),
      initiatedBy,
      alreadyRefunded: b.amountRefunded,
    });
  }

  /** Cancels a booking. Unpaid bookings simply release inventory; paid ones are refunded per policy. */
  async cancel(bookingId: string, actor: "traveler" | "provider" | "admin", actorId: string, reason: string) {
    const now = this.now();
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { allocations: { include: { payment: true } }, settlement: true } });
      const booking = { id: b.id, status: b.status as BookingStatus, version: b.version, confirmationPolicy: b.confirmationPolicy };
      const unpaid = ["awaiting_payment", "awaiting_provider_confirmation", "pending_availability", "draft"].includes(b.status);
      if (unpaid) {
        await this.release(tx, b.id);
        await this.transition(tx, booking, "cancelled", actor === "admin" ? "admin" : actor, actorId, reason, { cancelledAt: now, cancellationReason: reason });
        await tx.payment.updateMany({ where: { allocations: { some: { bookingId: b.id } }, status: "created" }, data: { status: "failed", failureReason: "Booking cancelled" } });
        await this.refreshTrip(tx, b.tripId);
        return { status: booking.status, refund: null };
      }
      if (b.status !== "confirmed") throw new DomainError("NOT_CANCELLABLE", "This booking can no longer be cancelled online. Contact support.");
      const computation = this.refundPreview(b, actor === "traveler" ? "traveler" : actor === "provider" ? "provider" : "platform");
      if (actor === "traveler") await this.transition(tx, booking, "cancellation_requested", "traveler", actorId, reason);
      await this.release(tx, b.id);
      const payment = b.allocations[0]?.payment;
      if (computation.total > 0 && payment) {
        await this.transition(tx, booking, "refund_pending", actor === "traveler" ? "system" : actor === "provider" ? "provider" : "admin", actor === "traveler" ? null : actorId, reason, { cancelledAt: now, cancellationReason: reason });
        const gw = await this.gateway.refund(payment.gatewayPaymentId ?? payment.gatewayOrderId, computation.total);
        await tx.refund.create({
          data: {
            bookingId: b.id,
            paymentId: payment.id,
            amount: computation.total,
            computation: computation as unknown as Prisma.InputJsonValue,
            initiatedBy: actor === "traveler" ? "traveler" : actor === "provider" ? "provider" : "platform",
            status: "succeeded",
            gatewayRefundId: gw.refundId,
            reason,
            idempotencyKey: `cancel:${b.id}`,
            createdAt: now,
          },
        });
        const full = computation.total + b.amountRefunded >= b.total;
        await this.transition(tx, booking, full ? "refunded" : "partially_refunded", "system", null, computation.reason, { amountRefunded: { increment: computation.total } });
        await tx.payment.update({ where: { id: payment.id }, data: { status: full ? "refunded" : "partially_refunded" } });
      } else {
        await this.transition(tx, booking, "cancelled", actor === "traveler" ? "system" : "admin", actor === "traveler" ? null : actorId, "No refund due under the cancellation policy", { cancelledAt: now, cancellationReason: reason });
      }
      if (b.settlement) {
        const reversal = Math.round((b.settlement.netPayout * computation.settlementReversalBps) / 10_000);
        await tx.bookingSettlement.update({ where: { bookingId: b.id }, data: { refundAdjustment: -reversal } });
      }
      await this.refreshTrip(tx, b.tripId);
      return { status: booking.status, refund: computation };
    });
  }

  /** Releases holds whose time ran out (unpaid bookings, unanswered requests). Safe to call often. */
  async expireHolds() {
    const now = this.now();
    const stale = await this.db.booking.findMany({
      where: { status: { in: ["awaiting_payment", "awaiting_provider_confirmation", "pending_availability"] }, holdExpiresAt: { lt: now } },
      select: { id: true },
      take: 100,
    });
    for (const { id } of stale) {
      await this.db
        .$transaction(async (tx) => {
          const b = await tx.booking.findUniqueOrThrow({ where: { id } });
          if (!b.holdExpiresAt || b.holdExpiresAt >= now) return;
          await this.release(tx, b.id);
          const to: BookingStatus = b.status === "pending_availability" ? "failed" : "expired";
          await this.transition(tx, { id: b.id, status: b.status, version: b.version, confirmationPolicy: b.confirmationPolicy }, to, "system", null, "Hold time ran out");
          await tx.payment.updateMany({ where: { allocations: { some: { bookingId: b.id } }, status: "created" }, data: { status: "failed", failureReason: "Hold expired" } });
          await this.refreshTrip(tx, b.tripId);
        })
        .catch(() => undefined); // a concurrent update already moved it on
    }
    return stale.length;
  }

  private async refreshTrip(tx: Tx, tripId: string) {
    const { deriveTripStatus } = await import("@kt/domain");
    const bookings = await tx.booking.findMany({ where: { tripId }, select: { status: true } });
    await tx.trip.update({ where: { id: tripId }, data: { status: deriveTripStatus(bookings.map((b) => b.status)) } });
  }
}
