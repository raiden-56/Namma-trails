import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BOOKING_STATUSES, type ListingStatus, type Principal, paginationSchema, publishBlockers } from "@kt/domain";
import { z } from "zod";
import { AuditService } from "../../common/audit/audit.service.js";
import { CurrentPrincipal, RequirePermissions } from "../../common/auth/principal.js";
import { ApiError } from "../../common/errors/api-error.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

const bookingsQuery = paginationSchema.extend({ status: z.enum(BOOKING_STATUSES).optional(), q: z.string().trim().max(80).optional() });
const ticketsQuery = paginationSchema.extend({ status: z.enum(["open", "pending_customer", "pending_provider", "escalated", "resolved", "closed"]).optional() });
const listingDecision = z.object({
  decision: z.enum(["approve", "publish", "request_changes", "reject", "pause"]),
  message: z.string().trim().max(1000).optional(),
});
const documentDecision = z.object({ decision: z.enum(["verify", "reject"]), reason: z.string().trim().max(500).optional() });

const LISTING_TARGET: Record<z.infer<typeof listingDecision>["decision"], { from: ListingStatus[]; to: ListingStatus }> = {
  approve: { from: ["pending_review", "changes_requested"], to: "approved" },
  publish: { from: ["pending_review", "approved", "paused"], to: "published" },
  request_changes: { from: ["pending_review", "approved", "published"], to: "changes_requested" },
  reject: { from: ["pending_review", "changes_requested"], to: "rejected" },
  pause: { from: ["published"], to: "paused" },
};

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bookings(q: z.infer<typeof bookingsQuery>) {
    const where: Prisma.BookingWhereInput = {
      status: q.status ?? { not: "draft" },
      ...(q.q
        ? {
            OR: [
              { reference: { contains: q.q.toUpperCase() } },
              { service: { title: { contains: q.q, mode: "insensitive" } } },
              { provider: { displayName: { contains: q.q, mode: "insensitive" } } },
              { traveler: { profile: { fullName: { contains: q.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          service: { select: { title: true, category: { select: { name: true } }, destination: { select: { name: true } } } },
          provider: { select: { displayName: true } },
          traveler: { select: { phone: true, profile: { select: { fullName: true } } } },
          settlement: { select: { commission: true, netPayout: true } },
        },
      }),
    ]);
    return {
      data: rows.map((b) => ({
        reference: b.reference,
        status: b.status,
        service: b.service.title,
        category: b.service.category.name,
        destination: b.service.destination.name,
        provider: b.provider.displayName,
        traveler: b.traveler?.profile?.fullName ?? "Guest",
        startsAt: b.startsAt,
        totalPaise: b.total,
        refundedPaise: b.amountRefunded,
        commissionPaise: b.settlement?.commission ?? null,
        createdAt: b.createdAt,
      })),
      meta: { page: q.page, pageSize: q.pageSize, total },
    };
  }

  async finance() {
    const paidStatuses = ["confirmed", "in_progress", "completed", "refunded", "partially_refunded", "disputed", "cancellation_requested", "refund_pending"] as const;
    const [gbv, settle, refunds, payouts, byCategory, payoutRows] = await Promise.all([
      this.prisma.booking.aggregate({ where: { status: { in: [...paidStatuses] } }, _sum: { total: true, serviceTax: true, platformFee: true }, _count: { _all: true } }),
      this.prisma.bookingSettlement.aggregate({ _sum: { commission: true, commissionTax: true, netPayout: true, refundAdjustment: true } }),
      this.prisma.refund.aggregate({ where: { status: "succeeded" }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payout.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ category: string; bookings: bigint; gbv: bigint; commission: bigint }[]>`
        SELECT c.name AS category, COUNT(b.id) AS bookings, COALESCE(SUM(b.total),0) AS gbv, COALESCE(SUM(s.commission),0) AS commission
        FROM bookings b JOIN services sv ON sv.id = b.service_id JOIN categories c ON c.id = sv.category_id
        LEFT JOIN booking_settlements s ON s.booking_id = b.id
        WHERE b.status IN ('confirmed','in_progress','completed','refunded','partially_refunded','disputed','cancellation_requested','refund_pending')
        GROUP BY c.name ORDER BY gbv DESC`,
      this.prisma.payout.findMany({ orderBy: { periodEnd: "desc" }, take: 20, include: { provider: { select: { displayName: true } } } }),
    ]);
    return {
      paidBookings: gbv._count._all,
      grossBookingValuePaise: gbv._sum.total ?? 0,
      serviceTaxCollectedPaise: gbv._sum.serviceTax ?? 0,
      convenienceFeesPaise: gbv._sum.platformFee ?? 0,
      commissionPaise: settle._sum.commission ?? 0,
      commissionTaxPaise: settle._sum.commissionTax ?? 0,
      partnerEarningsPaise: (settle._sum.netPayout ?? 0) + (settle._sum.refundAdjustment ?? 0),
      refundsPaise: refunds._sum.amount ?? 0,
      refundCount: refunds._count._all,
      payoutsByStatus: payouts.map((p) => ({ status: p.status, count: p._count._all, amountPaise: p._sum.amount ?? 0 })),
      byCategory: byCategory.map((r) => ({ category: r.category, bookings: Number(r.bookings), gbvPaise: Number(r.gbv), commissionPaise: Number(r.commission) })),
      payouts: payoutRows.map((p) => ({ id: p.id, provider: p.provider.displayName, periodStart: p.periodStart, periodEnd: p.periodEnd, amountPaise: p.amount, status: p.status, paidAt: p.paidAt })),
    };
  }

  async tickets(q: z.infer<typeof ticketsQuery>) {
    const where: Prisma.SupportTicketWhereInput = q.status ? { status: q.status } : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          requester: { select: { profile: { select: { fullName: true } } } },
          assignee: { select: { profile: { select: { fullName: true } } } },
          booking: { select: { reference: true } },
          provider: { select: { displayName: true } },
          _count: { select: { messages: true } },
        },
      }),
    ]);
    return {
      data: rows.map((t) => ({
        reference: t.reference,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        requester: t.requester?.profile?.fullName ?? "Unknown",
        assignee: t.assignee?.profile?.fullName ?? null,
        bookingReference: t.booking?.reference ?? null,
        provider: t.provider?.displayName ?? null,
        messages: t._count.messages,
        createdAt: t.createdAt,
      })),
      meta: { page: q.page, pageSize: q.pageSize, total },
    };
  }

  async ticket(reference: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { reference },
      include: {
        requester: { select: { email: true, phone: true, profile: { select: { fullName: true } } } },
        booking: { select: { reference: true, status: true } },
        provider: { select: { displayName: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!t) throw ApiError.notFound("Ticket");
    const authors = await this.prisma.user.findMany({ where: { id: { in: t.messages.map((m) => m.authorId).filter((x): x is string => Boolean(x)) } }, select: { id: true, profile: { select: { fullName: true } } } });
    return {
      reference: t.reference,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      incident: t.incident,
      requester: { name: t.requester?.profile?.fullName ?? null, email: t.requester?.email ?? null, phone: t.requester?.phone ?? null },
      booking: t.booking,
      provider: t.provider?.displayName ?? null,
      createdAt: t.createdAt,
      messages: t.messages.map((m) => ({ body: m.body, internal: m.isInternal, author: authors.find((a) => a.id === m.authorId)?.profile?.fullName ?? "System", createdAt: m.createdAt })),
    };
  }

  async decideListing(principal: Principal, serviceId: string, input: z.infer<typeof listingDecision>) {
    const s = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { provider: true, destination: true, category: true } });
    if (!s || s.deletedAt) throw ApiError.notFound("Listing");
    const rule = LISTING_TARGET[input.decision];
    if (!rule.from.includes(s.status as ListingStatus)) throw ApiError.conflict("LISTING_INVALID_TRANSITION", `A ${s.status} listing cannot be moved with "${input.decision}"`);
    if (rule.to === "published") {
      const [pc, dc] = await Promise.all([
        this.prisma.providerCategory.findUnique({ where: { providerId_categoryId: { providerId: s.providerId, categoryId: s.categoryId } } }),
        this.prisma.destinationCategory.findUnique({ where: { destinationId_categoryId: { destinationId: s.destinationId, categoryId: s.categoryId } } }),
      ]);
      const blockers = publishBlockers({
        providerStatus: s.provider.status,
        providerDocumentsVerified: s.provider.status === "approved",
        listingStatus: "approved",
        providerCategoryApproved: pc?.status === "approved",
        destinationStatus: s.destination.status,
        categoryEnabledInDestination: dc?.isEnabled ?? false,
        assetDocumentsVerified: true,
      }).filter((b) => b !== "destination_not_active"); // may publish ahead of the destination launch; it stays hidden until then
      if (blockers.length) throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "PUBLISH_BLOCKED", "This listing cannot be published yet", { blockers });
    }
    if ((input.decision === "reject" || input.decision === "request_changes") && (input.message?.length ?? 0) < 10) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "MESSAGE_REQUIRED", "Tell the partner what to change (10+ characters)");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id: s.id }, data: { status: rule.to, ...(rule.to === "published" && !s.publishedAt ? { publishedAt: new Date() } : {}) } });
      await tx.serviceReviewEvent.create({ data: { serviceId: s.id, actorId: principal.userId, event: `listing_${input.decision}`, fromStatus: s.status, toStatus: rule.to, message: input.message ?? null } });
      await this.audit.record({ actorId: principal.userId, actorType: "admin", action: `listing.${input.decision}`, entityType: "service", entityId: s.id, providerId: s.providerId, before: { status: s.status }, after: { status: rule.to } }, tx);
    });
    return { id: s.id, status: rule.to };
  }

  async decideDocument(principal: Principal, documentId: string, input: z.infer<typeof documentDecision>) {
    const d = await this.prisma.providerDocument.findUnique({ where: { id: documentId } });
    if (!d) throw ApiError.notFound("Document");
    if (d.status !== "pending" && !(d.status === "rejected" && input.decision === "verify")) throw ApiError.conflict("DOCUMENT_ALREADY_DECIDED", `This document is already ${d.status}`);
    if (input.decision === "reject" && (input.reason?.length ?? 0) < 5) throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "REASON_REQUIRED", "Give the partner a reason");
    const status = input.decision === "verify" ? "verified" : "rejected";
    await this.prisma.$transaction(async (tx) => {
      await tx.providerDocument.update({ where: { id: d.id }, data: { status, reviewedBy: principal.userId, reviewedAt: new Date(), rejectionReason: input.decision === "reject" ? input.reason! : null } });
      await tx.providerVerificationEvent.create({ data: { providerId: d.providerId, actorId: principal.userId, event: `document_${status}`, documentId: d.id, message: input.decision === "reject" ? input.reason! : null } });
      await this.audit.record({ actorId: principal.userId, actorType: "admin", action: `document.${input.decision}`, entityType: "provider_document", entityId: d.id, providerId: d.providerId, after: { status } }, tx);
    });
    return { id: d.id, status };
  }
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller({ path: "admin", version: "1" })
export class AdminOpsController {
  constructor(private readonly ops: AdminOpsService) {}

  @Get("bookings")
  @RequirePermissions("booking.read_any")
  bookings(@Query(new ZodPipe(bookingsQuery)) q: z.infer<typeof bookingsQuery>) {
    return this.ops.bookings(q);
  }

  @Get("finance")
  @RequirePermissions("finance.read")
  async finance() {
    return { data: await this.ops.finance() };
  }

  @Get("support/tickets")
  @RequirePermissions("support.ticket.read_any")
  tickets(@Query(new ZodPipe(ticketsQuery)) q: z.infer<typeof ticketsQuery>) {
    return this.ops.tickets(q);
  }

  @Get("support/tickets/:reference")
  @RequirePermissions("support.ticket.read_any")
  async ticket(@Param("reference") reference: string) {
    return { data: await this.ops.ticket(reference) };
  }

  @Post("listings/:serviceId/decision")
  @HttpCode(200)
  @RequirePermissions("listing.moderate")
  @ApiOperation({ summary: "Approve, publish, pause, reject or request changes on a listing (audited)" })
  async decideListing(@CurrentPrincipal() principal: Principal, @Param("serviceId", ParseUUIDPipe) serviceId: string, @Body(new ZodPipe(listingDecision)) body: z.infer<typeof listingDecision>) {
    return { data: await this.ops.decideListing(principal, serviceId, body) };
  }

  @Post("documents/:documentId/decision")
  @HttpCode(200)
  @RequirePermissions("provider.document.verify")
  async decideDocument(@CurrentPrincipal() principal: Principal, @Param("documentId", ParseUUIDPipe) documentId: string, @Body(new ZodPipe(documentDecision)) body: z.infer<typeof documentDecision>) {
    return { data: await this.ops.decideDocument(principal, documentId, body) };
  }
}
