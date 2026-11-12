import { Body, Controller, Get, HttpStatus, Injectable, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PROVIDER_STATUSES, type Principal, assertProviderTransition, paginationSchema, providerNextStatuses } from "@kt/domain";
import { z } from "zod";
import { AuditService } from "../../common/audit/audit.service.js";
import { CurrentPrincipal, RequirePermissions } from "../../common/auth/principal.js";
import { ApiError } from "../../common/errors/api-error.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { ProviderStatus } from "../../generated/prisma/client.js";
import { ProviderOnboardingService } from "../provider-onboarding/provider-onboarding.service.js";

/** status omitted = review queue (submitted + under review); "all" = every application. */
const listQuery = paginationSchema.extend({ status: z.union([z.enum(PROVIDER_STATUSES), z.literal("all")]).optional() });
const decisionSchema = z
  .object({
    decision: z.enum(["start_review", "approve", "reject", "request_info", "suspend", "reinstate"]),
    /** Shown to the provider. Required when rejecting, requesting information or suspending. */
    message: z.string().trim().max(2000).optional(),
    /** Admin-only note. */
    internalNote: z.string().trim().max(4000).optional(),
  })
  .refine((v) => !["reject", "request_info", "suspend"].includes(v.decision) || (v.message?.length ?? 0) >= 10, {
    message: "Explain the reason to the provider (10+ characters)",
    path: ["message"],
  });

type Decision = z.infer<typeof decisionSchema>["decision"];

const TARGET: Record<Decision, ProviderStatus> = {
  start_review: "under_review",
  approve: "approved",
  reject: "rejected",
  request_info: "info_requested",
  suspend: "suspended",
  reinstate: "approved",
};

@Injectable()
export class ProviderVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: ProviderOnboardingService,
    private readonly audit: AuditService,
  ) {}

  async list(query: z.infer<typeof listQuery>) {
    const statusFilter =
      query.status === "all" ? {} : query.status ? { status: query.status } : { status: { in: ["submitted", "under_review"] as ProviderStatus[] } };
    const where = { deletedAt: null, ...statusFilter };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.provider.count({ where }),
      this.prisma.provider.findMany({
        where,
        orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], // oldest submission first (SLA order), then newest drafts
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          displayName: true,
          businessType: true,
          district: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          isDemo: true,
          categories: { select: { status: true, category: { select: { key: true } } } },
          _count: { select: { documents: { where: { status: "pending" } } } },
        },
      }),
    ]);
    return {
      data: rows.map(({ _count, categories, ...r }) => ({ ...r, categories: categories.map((c) => ({ key: c.category.key, status: c.status })), pendingDocuments: _count.documents })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  /** Full admin view of one application, including contact details, internal notes and the decisions allowed now. */
  async detail(providerId: string) {
    const p = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        members: { where: { role: "owner", status: "active" }, include: { user: { select: { email: true, phone: true, profile: { select: { fullName: true } } } } } },
        categories: { include: { category: { select: { key: true, name: true } } } },
        destinations: { include: { destination: { select: { slug: true, name: true, status: true } } } },
        documents: { where: { status: { not: "superseded" } }, include: { documentType: { select: { key: true, label: true } } }, orderBy: { createdAt: "desc" } },
        verificationEvents: { orderBy: { createdAt: "desc" }, include: { actor: { select: { profile: { select: { fullName: true } }, email: true } } } },
      },
    });
    if (!p || p.deletedAt) throw ApiError.notFound("Provider");
    const evaluation = await this.onboarding.evaluate(providerId);
    const owner = p.members[0]?.user;
    return {
      id: p.id,
      displayName: p.displayName,
      legalName: p.legalName,
      businessType: p.businessType,
      description: p.description,
      registrationNumber: p.registrationNumber,
      gstin: p.gstin,
      status: p.status,
      submittedAt: p.submittedAt,
      approvedAt: p.approvedAt,
      createdAt: p.createdAt,
      isDemo: p.isDemo,
      contact: { email: p.contactEmail, phone: p.contactPhone, website: p.website },
      address: { line1: p.addressLine1, line2: p.addressLine2, city: p.city, district: p.district, state: p.state, pincode: p.pincode },
      owner: owner ? { name: owner.profile?.fullName ?? null, email: owner.email, phone: owner.phone } : null,
      categories: p.categories.map((c) => ({ key: c.category.key, name: c.category.name, status: c.status })),
      destinations: p.destinations.map((d) => d.destination),
      documents: p.documents.map((d) => ({
        id: d.id,
        type: d.documentType.key,
        label: d.documentType.label,
        number: d.documentNumber,
        status: d.status,
        expiresOn: d.expiresOn ? d.expiresOn.toISOString().slice(0, 10) : null,
        rejectionReason: d.rejectionReason,
      })),
      requirements: {
        missing: evaluation.missing.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        pendingReview: evaluation.pendingReview.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        rejected: evaluation.rejected.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        expired: evaluation.expired.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        fullyVerified: evaluation.fullyVerified,
      },
      history: p.verificationEvents.map((e) => ({
        event: e.event,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        message: e.message,
        internalNote: e.internalNote,
        actor: e.actor ? (e.actor.profile?.fullName ?? e.actor.email ?? "Admin") : null,
        createdAt: e.createdAt,
      })),
      allowedDecisions: (Object.keys(TARGET) as Decision[]).filter((d) => providerNextStatuses(p.status, "admin").includes(TARGET[d]) && !(d === "reinstate" && p.status !== "suspended") && !(d === "approve" && p.status === "suspended")),
    };
  }

  async decide(principal: Principal, providerId: string, input: z.infer<typeof decisionSchema>) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { id: true, status: true, deletedAt: true } });
    if (!provider || provider.deletedAt) throw ApiError.notFound("Provider");
    const to = TARGET[input.decision];
    const rule = assertProviderTransition(provider.status, to, "admin");

    if (input.decision === "approve") {
      const evaluation = await this.onboarding.evaluate(providerId);
      if (!evaluation.fullyVerified) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "DOCUMENTS_NOT_VERIFIED", "Verify every required document before approving", {
          missing: evaluation.missing.map((r) => r.documentTypeKey),
          pending: evaluation.pendingReview.map((r) => r.documentTypeKey),
          rejected: evaluation.rejected.map((r) => r.documentTypeKey),
          expired: evaluation.expired.map((r) => r.documentTypeKey),
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.provider.updateMany({
        where: { id: providerId, status: provider.status },
        data: {
          status: to,
          ...(to === "approved" ? { approvedAt: now, suspendedReason: null } : {}),
          ...(to === "suspended" ? { suspendedReason: input.message ?? null } : {}),
        },
      });
      if (count !== 1) throw ApiError.conflict("STALE_STATUS", "The application changed. Refresh and try again.");
      if (input.decision === "approve") {
        await tx.providerCategory.updateMany({ where: { providerId, status: "pending" }, data: { status: "approved", reviewedBy: principal.userId, reviewedAt: now } });
      }
      await tx.providerVerificationEvent.create({
        data: { providerId, actorId: principal.userId, event: rule.event, fromStatus: provider.status, toStatus: to, message: input.message ?? null, internalNote: input.internalNote ?? null },
      });
      await this.audit.record(
        { actorId: principal.userId, actorType: "admin", action: `provider.${input.decision}`, entityType: "provider", entityId: providerId, providerId, before: { status: provider.status }, after: { status: to } },
        tx,
      );
    });
    // Notification to the provider is queued here in Phase 7 (notifications module).
    return { id: providerId, status: to };
  }
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller({ path: "admin/provider-applications", version: "1" })
export class ProviderVerificationController {
  constructor(private readonly verification: ProviderVerificationService) {}

  @Get()
  @RequirePermissions("provider.application.read")
  list(@Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    return this.verification.list(query);
  }

  @Get(":providerId")
  @RequirePermissions("provider.application.read")
  async detail(@Param("providerId", ParseUUIDPipe) providerId: string) {
    return { data: await this.verification.detail(providerId) };
  }

  @Post(":providerId/decision")
  @RequirePermissions("provider.application.review")
  async decide(
    @CurrentPrincipal() principal: Principal,
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Body(new ZodPipe(decisionSchema)) body: z.infer<typeof decisionSchema>,
  ) {
    return { data: await this.verification.decide(principal, providerId, body) };
  }
}
