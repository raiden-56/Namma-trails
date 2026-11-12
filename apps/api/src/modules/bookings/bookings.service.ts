import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { DomainError, type ListingStatus, type Principal, istDateOf } from "@kt/domain";
import { AuditService } from "../../common/audit/audit.service.js";
import { PrincipalService } from "../../common/auth/principal.service.js";
import { ApiError } from "../../common/errors/api-error.js";
import { ENV, type Env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { type BookingRequest, BookingEngine, type GuestInput } from "./engine.js";
import { MockGateway } from "./support.js";

const BOOKING_LIST_INCLUDE = {
  service: { select: { slug: true, title: true, category: { select: { key: true, name: true } }, destination: { select: { slug: true, name: true } }, media: { where: { isCover: true }, include: { media: true }, take: 1 } } },
  provider: { select: { id: true, displayName: true, contactPhone: true } },
  trip: { select: { reference: true } },
  allocations: { include: { payment: { select: { id: true, status: true, gatewayOrderId: true, amount: true } } } },
  settlement: true,
  review: { select: { rating: true } },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_LIST_INCLUDE }>;

const coverUrl = (b: BookingRow) => {
  const m = b.service.media[0]?.media;
  return m ? (m.bucket === "static" ? m.objectKey : `/media/${m.objectKey}`) : null;
};

function summarise(b: BookingRow) {
  const pendingPayment = b.allocations.map((a) => a.payment).find((p) => p.status === "created");
  return {
    id: b.id,
    reference: b.reference,
    tripReference: b.trip.reference,
    status: b.status,
    service: { slug: b.service.slug, title: b.service.title, category: b.service.category.name, categoryKey: b.service.category.key, destination: b.service.destination.name, coverImageUrl: coverUrl(b) },
    provider: { name: b.provider.displayName },
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    units: b.units,
    adults: b.adults,
    children: b.children,
    totalPaise: b.total,
    refundedPaise: b.amountRefunded,
    confirmationPolicy: b.confirmationPolicy,
    holdExpiresAt: b.holdExpiresAt,
    pendingPayment: pendingPayment ? { id: pendingPayment.id, amountPaise: pendingPayment.amount } : null,
    reviewed: Boolean(b.review),
    createdAt: b.createdAt,
  };
}

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Bookings");
  readonly engine: BookingEngine;
  private sweeper: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly principals: PrincipalService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {
    if (env.PAYMENT_PROVIDER !== "mock") throw new Error(`Payment provider "${env.PAYMENT_PROVIDER}" is not implemented yet (Phase 6)`);
    this.engine = new BookingEngine(prisma, new MockGateway());
  }

  onModuleInit() {
    if (this.env.NODE_ENV === "test") return;
    this.sweeper = setInterval(() => {
      this.engine.expireHolds().catch((e: unknown) => this.logger.warn(`Hold sweep failed: ${String(e)}`));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  notFound(): never {
    throw ApiError.notFound("Service");
  }

  quote(req: BookingRequest) {
    return this.engine.quote(req);
  }

  /* ─────────────── traveller ─────────────── */

  async create(principal: Principal, body: BookingRequest & { guests?: GuestInput[]; specialRequests?: string }, idempotencyKey?: string) {
    const { guests, specialRequests, ...req } = body;
    if (idempotencyKey) {
      const prior = await this.prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (prior && prior.userId === principal.userId && prior.responseBody) return prior.responseBody;
    }
    const result = await this.engine.create(req, principal.userId, { ...(guests ? { guests } : {}), ...(specialRequests ? { specialRequests } : {}) });
    if (idempotencyKey) {
      await this.prisma.idempotencyKey
        .create({ data: { key: idempotencyKey, userId: principal.userId, scope: "booking.create", requestHash: "-", responseCode: 201, responseBody: JSON.parse(JSON.stringify(result)) } })
        .catch(() => undefined);
    }
    return result;
  }

  async myTrips(userId: string) {
    const rows = await this.prisma.booking.findMany({ where: { travelerId: userId, status: { not: "draft" } }, orderBy: { startsAt: "desc" }, include: BOOKING_LIST_INCLUDE, take: 100 });
    return rows.map(summarise);
  }

  private async ownBooking(userId: string, ref: string) {
    const b = await this.prisma.booking.findUnique({
      where: { reference: ref },
      include: {
        ...BOOKING_LIST_INCLUDE,
        guests: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        refunds: { orderBy: { createdAt: "desc" } },
        service: { select: { ...BOOKING_LIST_INCLUDE.service.select, locations: { select: { kind: true, name: true, addressLine: true, instructions: true } }, safetyInfo: true } },
      },
    });
    if (!b || b.travelerId !== userId) throw ApiError.notFound("Booking");
    return b;
  }

  async myBooking(userId: string, ref: string) {
    const b = await this.ownBooking(userId, ref);
    const cancellable = ["awaiting_payment", "awaiting_provider_confirmation", "confirmed"].includes(b.status);
    return {
      ...summarise(b as unknown as BookingRow),
      quote: b.quote,
      request: b.request,
      guests: b.guests.map((g) => ({ fullName: g.fullName, isLead: g.isLead })),
      provider: { name: b.provider.displayName, phone: ["confirmed", "in_progress"].includes(b.status) ? b.provider.contactPhone : null },
      locations: b.service.locations,
      safetyInfo: b.service.safetyInfo,
      cancellationPolicy: b.cancellationPolicy,
      cancellable,
      refundPreview: b.status === "confirmed" ? this.engine.refundPreview(b) : null,
      refunds: b.refunds.map((r) => ({ amountPaise: r.amount, status: r.status, createdAt: r.createdAt, reason: r.reason })),
      history: b.statusHistory.map((h) => ({ status: h.toStatus, event: h.event, at: h.createdAt, note: h.note })),
      canReview: b.status === "completed" && !b.review,
    };
  }

  async cancelMine(userId: string, ref: string, reason: string) {
    const b = await this.ownBooking(userId, ref);
    return this.engine.cancel(b.id, "traveler", userId, reason);
  }

  async review(userId: string, ref: string, input: { rating: number; title?: string; body?: string }) {
    const b = await this.ownBooking(userId, ref);
    if (b.status !== "completed") throw new DomainError("REVIEW_NOT_ALLOWED", "You can review a booking after it is completed");
    const review = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.create({ data: { bookingId: b.id, serviceId: b.serviceId, providerId: b.providerId, userId, rating: input.rating, title: input.title ?? null, body: input.body ?? null } });
      await this.refreshRatings(tx, b.serviceId, b.providerId);
      return r;
    });
    return { id: review.id };
  }

  async refreshRatings(tx: Prisma.TransactionClient, serviceId: string, providerId: string) {
    const [svc, prov] = await Promise.all([
      tx.review.aggregate({ where: { serviceId, status: "published" }, _avg: { rating: true }, _count: { _all: true } }),
      tx.review.aggregate({ where: { providerId, status: "published" }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    await tx.service.update({ where: { id: serviceId }, data: { ratingAvg: svc._avg.rating ?? null, ratingCount: svc._count._all } });
    await tx.provider.update({ where: { id: providerId }, data: { ratingAvg: prov._avg.rating ?? null, ratingCount: prov._count._all } });
  }

  /** DEVELOPMENT ONLY: simulates the gateway telling us a payment succeeded or failed. */
  async mockComplete(userId: string, paymentId: string, outcome: "success" | "failure") {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { trip: true } });
    if (!p || p.trip.userId !== userId) throw ApiError.notFound("Payment");
    if (outcome === "failure") {
      await this.engine.failPayment(paymentId, "Payment declined (simulated)");
      return { status: "failed" };
    }
    return this.engine.confirmPayment(paymentId, `mock_pay_${p.id.replace(/-/g, "").slice(0, 16)}`);
  }

  /* ─────────────── partner (org-scoped) ─────────────── */

  async partnerDashboard(principal: Principal, providerId: string) {
    this.principals.assertOrg(principal, "org.booking.read", providerId);
    const now = new Date();
    const today = istDateOf(now);
    const dayStart = new Date(`${today}T00:00:00+05:30`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+05:30`);
    const live = ["confirmed", "in_progress"] as const;
    const [todayCount, upcoming, requests, monthSettlements, provider, views, completed, cancelled] = await Promise.all([
      this.prisma.booking.count({ where: { providerId, status: { in: [...live, "completed"] }, startsAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.booking.count({ where: { providerId, status: { in: [...live] }, startsAt: { gte: now } } }),
      this.prisma.booking.count({ where: { providerId, status: "awaiting_provider_confirmation" } }),
      this.prisma.bookingSettlement.aggregate({ where: { booking: { providerId, startsAt: { gte: monthStart } } }, _sum: { netPayout: true, refundAdjustment: true } }),
      this.prisma.provider.findUniqueOrThrow({ where: { id: providerId }, select: { ratingAvg: true, ratingCount: true } }),
      this.prisma.service.aggregate({ where: { providerId }, _sum: { viewCount: true } }),
      this.prisma.booking.count({ where: { providerId, status: "completed" } }),
      this.prisma.booking.count({ where: { providerId, status: { in: ["cancelled", "refunded", "partially_refunded"] } } }),
    ]);
    return {
      bookingsToday: todayCount,
      upcomingBookings: upcoming,
      pendingRequests: requests,
      completedBookings: completed,
      cancelledBookings: cancelled,
      earningsThisMonthPaise: (monthSettlements._sum.netPayout ?? 0) + (monthSettlements._sum.refundAdjustment ?? 0),
      listingViews: views._sum.viewCount ?? 0,
      rating: { average: provider.ratingAvg ? Number(provider.ratingAvg) : null, count: provider.ratingCount },
    };
  }

  async partnerListings(principal: Principal, providerId: string) {
    this.principals.assertOrg(principal, "org.listing.read", providerId);
    const rows = await this.prisma.service.findMany({
      where: { providerId, deletedAt: null },
      orderBy: { title: "asc" },
      include: {
        category: { select: { name: true } },
        destination: { select: { name: true } },
        pricePlans: { where: { isActive: true }, select: { model: true }, take: 1 },
        media: { where: { isCover: true }, include: { media: true }, take: 1 },
        _count: { select: { bookings: true, inventoryItems: true } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      status: s.status as ListingStatus,
      category: s.category.name,
      destination: s.destination.name,
      fromPricePaise: s.fromPrice,
      priceUnitLabel: s.pricePlans[0]?.model ?? null,
      rating: { average: s.ratingAvg ? Number(s.ratingAvg) : null, count: s.ratingCount },
      views: s.viewCount,
      bookings: s._count.bookings,
      inventoryItems: s._count.inventoryItems,
      confirmationPolicy: s.confirmationPolicy,
      coverImageUrl: s.media[0] ? (s.media[0].media.bucket === "static" ? s.media[0].media.objectKey : null) : null,
    }));
  }

  async partnerBookings(principal: Principal, providerId: string, view: "requests" | "upcoming" | "past" | "all") {
    this.principals.assertOrg(principal, "org.booking.read", providerId);
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      providerId,
      status: { not: "draft" },
      ...(view === "requests" ? { status: "awaiting_provider_confirmation" } : {}),
      ...(view === "upcoming" ? { status: { in: ["confirmed", "in_progress", "awaiting_payment"] }, endsAt: { gte: now } } : {}),
      ...(view === "past" ? { OR: [{ endsAt: { lt: now } }, { status: { in: ["completed", "cancelled", "refunded", "partially_refunded", "expired", "failed"] } }] } : {}),
    };
    const canSeeContact = principal.orgPermissions.get(providerId)?.has("org.customer_contact.read") ?? false;
    const rows = await this.prisma.booking.findMany({
      where,
      orderBy: { startsAt: view === "past" ? "desc" : "asc" },
      take: 200,
      include: { ...BOOKING_LIST_INCLUDE, guests: { where: { isLead: true }, take: 1 }, traveler: { select: { phone: true, profile: { select: { fullName: true } } } } },
    });
    return rows.map((b) => ({
      ...summarise(b as unknown as BookingRow),
      guest: {
        name: b.guests[0]?.fullName ?? b.traveler?.profile?.fullName ?? "Guest",
        // PII minimisation: contact only with permission, and only for live bookings.
        phone: canSeeContact && ["confirmed", "in_progress", "awaiting_provider_confirmation"].includes(b.status) ? (b.guests[0]?.phone ?? b.traveler?.phone ?? null) : null,
      },
      payoutPaise: b.settlement ? b.settlement.netPayout + b.settlement.refundAdjustment : null,
      specialRequests: b.specialRequests,
      providerRespondBy: b.providerRespondBy,
    }));
  }

  async partnerAct(principal: Principal, providerId: string, ref: string, action: "accept" | "reject" | "start" | "complete" | "cancel", reason?: string) {
    this.principals.assertOrg(principal, "org.booking.manage", providerId);
    const b = await this.prisma.booking.findUnique({ where: { reference: ref }, select: { id: true, providerId: true } });
    // The booking's own provider is authoritative, never the URL.
    if (!b || b.providerId !== providerId) throw ApiError.notFound("Booking");
    const result = await (async () => {
      switch (action) {
        case "accept":
          return this.engine.providerAccept(b.id, principal.userId);
        case "reject":
          return this.engine.providerReject(b.id, principal.userId, reason ?? "Declined by partner");
        case "start":
          return this.engine.markStarted(b.id, principal.userId);
        case "complete":
          return this.engine.markCompleted(b.id, principal.userId);
        case "cancel":
          return this.engine.cancel(b.id, "provider", principal.userId, reason ?? "Cancelled by partner");
      }
    })();
    await this.audit.record({ actorId: principal.userId, actorType: "provider", action: `booking.${action}`, entityType: "booking", entityId: b.id, providerId, after: { reason: reason ?? null } });
    return result ?? { ok: true };
  }

  async partnerFinance(principal: Principal, providerId: string) {
    this.principals.assertOrg(principal, "org.finance.read", providerId);
    const today = new Date(`${istDateOf(new Date())}T00:00:00Z`);
    const [all, pending, payouts, recent] = await Promise.all([
      this.prisma.bookingSettlement.aggregate({ where: { booking: { providerId } }, _sum: { providerServiceValue: true, commission: true, commissionTax: true, serviceTaxPassThrough: true, netPayout: true, refundAdjustment: true } }),
      this.prisma.bookingSettlement.aggregate({ where: { booking: { providerId }, payoutId: null }, _sum: { netPayout: true, refundAdjustment: true } }),
      this.prisma.payout.findMany({ where: { providerId }, orderBy: { periodEnd: "desc" }, take: 12 }),
      this.prisma.bookingSettlement.findMany({
        where: { booking: { providerId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { booking: { select: { reference: true, startsAt: true, status: true, total: true, service: { select: { title: true } } } } },
      }),
    ]);
    const s = all._sum;
    return {
      grossServiceValuePaise: s.providerServiceValue ?? 0,
      commissionPaise: s.commission ?? 0,
      commissionTaxPaise: s.commissionTax ?? 0,
      taxCollectedPaise: s.serviceTaxPassThrough ?? 0,
      refundAdjustmentsPaise: s.refundAdjustment ?? 0,
      netEarningsPaise: (s.netPayout ?? 0) + (s.refundAdjustment ?? 0),
      pendingSettlementPaise: (pending._sum.netPayout ?? 0) + (pending._sum.refundAdjustment ?? 0),
      paidOutPaise: payouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0),
      payouts: payouts.map((p) => ({ id: p.id, periodStart: p.periodStart, periodEnd: p.periodEnd, amountPaise: p.amount, status: p.status, paidAt: p.paidAt })),
      settlements: recent.map((r) => ({
        reference: r.booking.reference,
        service: r.booking.service.title,
        startsAt: r.booking.startsAt,
        bookingStatus: r.booking.status,
        bookingTotalPaise: r.booking.total,
        commissionPaise: r.commission + r.commissionTax,
        netPaise: r.netPayout + r.refundAdjustment,
        eligible: r.eligibleOn ? r.eligibleOn <= today : false,
        paidOut: Boolean(r.payoutId),
      })),
    };
  }
}
