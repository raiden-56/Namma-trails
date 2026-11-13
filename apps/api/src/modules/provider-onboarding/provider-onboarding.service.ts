import { randomBytes } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import {
  type DocumentRequirement,
  type ProviderBusinessInput,
  type ProviderCategoriesInput,
  type Principal,
  assertProviderTransition,
  evaluateDocuments,
  istDateOf,
} from "@kt/domain";
import { AuditService } from "../../common/audit/audit.service.js";
import { PrincipalService } from "../../common/auth/principal.service.js";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { ProviderStatus } from "../../generated/prisma/client.js";

const EDITABLE: ProviderStatus[] = ["draft", "info_requested", "rejected"];

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${base || "partner"}-${randomBytes(3).toString("hex")}`;
}

const toDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class ProviderOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly principals: PrincipalService,
    private readonly audit: AuditService,
  ) {}

  /** Starts an application. The creating user becomes the organisation owner. */
  async create(principal: Principal, input: ProviderBusinessInput) {
    const existingDraft = await this.prisma.providerMember.findFirst({
      where: { userId: principal.userId, role: "owner", provider: { status: "draft", deletedAt: null } },
      select: { providerId: true },
    });
    if (existingDraft) {
      throw ApiError.conflict("DRAFT_EXISTS", "You already have an application in progress", { providerId: existingDraft.providerId });
    }
    return this.prisma.$transaction(async (tx) => {
      const provider = await tx.provider.create({
        data: {
          slug: slugify(input.displayName),
          ...this.businessData(input),
          status: "draft",
          members: { create: { userId: principal.userId, role: "owner", status: "active" } },
          verificationEvents: { create: { actorId: principal.userId, event: "application_created", toStatus: "draft" } },
        },
        select: { id: true, slug: true, status: true },
      });
      await this.audit.record(
        { actorId: principal.userId, actorType: "provider", action: "provider.application.create", entityType: "provider", entityId: provider.id, providerId: provider.id },
        tx,
      );
      return provider;
    });
  }

  async updateBusiness(principal: Principal, providerId: string, input: ProviderBusinessInput) {
    this.principals.assertOrg(principal, "org.profile.update", providerId);
    const provider = await this.load(providerId);
    if (!EDITABLE.includes(provider.status)) {
      throw ApiError.conflict("APPLICATION_LOCKED", "Business details cannot be changed while the application is under review");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.provider.update({ where: { id: providerId }, data: this.businessData(input) });
      await this.audit.record(
        { actorId: principal.userId, actorType: "provider", action: "provider.business.update", entityType: "provider", entityId: providerId, providerId },
        tx,
      );
    });
    return this.status(principal, providerId);
  }

  /** Replaces the categories (each re-enters pending approval) and operating destinations. */
  async setScope(principal: Principal, providerId: string, input: ProviderCategoriesInput) {
    this.principals.assertOrg(principal, "org.profile.update", providerId);
    const provider = await this.load(providerId);
    if (!EDITABLE.includes(provider.status)) {
      throw ApiError.conflict("APPLICATION_LOCKED", "Categories cannot be changed while the application is under review");
    }
    const [categories, destinations] = await Promise.all([
      this.prisma.category.findMany({ where: { key: { in: input.categoryKeys }, isActive: true }, select: { id: true, key: true } }),
      this.prisma.destination.findMany({ where: { slug: { in: input.destinationSlugs }, status: { not: "draft" } }, select: { id: true } }),
    ]);
    if (categories.length !== new Set(input.categoryKeys).size) throw ApiError.badRequest("UNKNOWN_CATEGORY", "One or more categories are not available");
    if (destinations.length !== new Set(input.destinationSlugs).size) throw ApiError.badRequest("UNKNOWN_DESTINATION", "One or more destinations are not open for partners yet");

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Soft delete: a dropped category or town is marked as removed, never deleted.
      await tx.providerCategory.updateMany({ where: { providerId, removedAt: null, categoryId: { notIn: categories.map((c) => c.id) } }, data: { removedAt: now } });
      for (const c of categories) {
        const key = { providerId_categoryId: { providerId, categoryId: c.id } };
        const existing = await tx.providerCategory.findUnique({ where: key, select: { removedAt: true } });
        if (!existing) await tx.providerCategory.create({ data: { providerId, categoryId: c.id } });
        // A category that comes back is reviewed again, exactly like a new one.
        else if (existing.removedAt) await tx.providerCategory.update({ where: key, data: { removedAt: null, status: "pending", reviewedBy: null, reviewedAt: null } });
      }
      await tx.providerDestination.updateMany({ where: { providerId, removedAt: null, destinationId: { notIn: destinations.map((d) => d.id) } }, data: { removedAt: now } });
      for (const d of destinations) {
        await tx.providerDestination.upsert({
          where: { providerId_destinationId: { providerId, destinationId: d.id } },
          create: { providerId, destinationId: d.id },
          update: { removedAt: null },
        });
      }
      await this.audit.record(
        { actorId: principal.userId, actorType: "provider", action: "provider.scope.update", entityType: "provider", entityId: providerId, providerId, after: input },
        tx,
      );
    });
    return this.status(principal, providerId);
  }

  /** Everything the applicant needs: status, missing documents, and the provider-visible review history. */
  async status(principal: Principal, providerId: string) {
    this.principals.assertOrg(principal, "org.profile.read", providerId);
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        categories: { where: { removedAt: null }, include: { category: { select: { id: true, key: true, name: true } } } },
        destinations: { where: { removedAt: null }, include: { destination: { select: { id: true, slug: true, name: true } } } },
        documents: { where: { inventoryItemId: null, status: { not: "superseded" } }, include: { documentType: { select: { key: true, label: true } } } },
        verificationEvents: {
          orderBy: { createdAt: "asc" },
          // internalNote is deliberately not selected: it is for admins only.
          select: { event: true, fromStatus: true, toStatus: true, message: true, createdAt: true },
        },
      },
    });
    if (!provider || provider.deletedAt) throw ApiError.notFound("Provider");
    const evaluation = await this.evaluate(provider.id);
    return {
      id: provider.id,
      slug: provider.slug,
      displayName: provider.displayName,
      legalName: provider.legalName,
      businessType: provider.businessType,
      status: provider.status,
      submittedAt: provider.submittedAt,
      approvedAt: provider.approvedAt,
      categories: provider.categories.map((c) => ({ key: c.category.key, name: c.category.name, status: c.status })),
      destinations: provider.destinations.map((d) => d.destination),
      documents: provider.documents.map((d) => ({
        id: d.id,
        type: d.documentType.key,
        label: d.documentType.label,
        status: d.status,
        expiresOn: toDate(d.expiresOn),
        rejectionReason: d.rejectionReason,
      })),
      requirements: {
        missing: evaluation.missing.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        rejected: evaluation.rejected.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        expired: evaluation.expired.map((r) => ({ type: r.documentTypeKey, label: r.label })),
        expiringSoon: evaluation.expiringSoon.map((e) => ({ type: e.requirement.documentTypeKey, label: e.requirement.label, expiresOn: e.expiresOn })),
        readyToSubmit: evaluation.readyToSubmit && provider.categories.length > 0 && provider.destinations.length > 0,
      },
      history: provider.verificationEvents,
    };
  }

  async submit(principal: Principal, providerId: string) {
    this.principals.assertOrg(principal, "org.profile.update", providerId);
    const provider = await this.load(providerId);
    if (provider.status === "rejected") {
      throw ApiError.conflict("REOPEN_REQUIRED", "Reopen the application before resubmitting");
    }
    const [evaluation, scope] = await Promise.all([
      this.evaluate(providerId),
      this.prisma.provider.findUniqueOrThrow({ where: { id: providerId }, select: { _count: { select: { categories: { where: { removedAt: null } }, destinations: { where: { removedAt: null } } } } } }),
    ]);
    if (scope._count.categories === 0 || scope._count.destinations === 0) {
      throw ApiError.badRequest("SCOPE_REQUIRED", "Choose at least one service category and destination");
    }
    if (!evaluation.readyToSubmit) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "DOCUMENTS_INCOMPLETE", "Some required documents are missing or need replacing", {
        missing: evaluation.missing.map((r) => r.documentTypeKey),
        rejected: evaluation.rejected.map((r) => r.documentTypeKey),
        expired: evaluation.expired.map((r) => r.documentTypeKey),
      });
    }
    const rule = assertProviderTransition(provider.status, "submitted", "provider");
    await this.prisma.$transaction(async (tx) => {
      // Conditional update guards against a concurrent status change.
      const { count } = await tx.provider.updateMany({ where: { id: providerId, status: provider.status }, data: { status: "submitted", submittedAt: new Date() } });
      if (count !== 1) throw ApiError.conflict("STALE_STATUS", "The application changed. Refresh and try again.");
      await tx.providerVerificationEvent.create({ data: { providerId, actorId: principal.userId, event: rule.event, fromStatus: provider.status, toStatus: "submitted" } });
      await this.audit.record(
        { actorId: principal.userId, actorType: "provider", action: "provider.application.submit", entityType: "provider", entityId: providerId, providerId },
        tx,
      );
    });
    return this.status(principal, providerId);
  }

  /** Evaluates business-level documents against requirements for the provider's categories and jurisdiction. */
  async evaluate(providerId: string) {
    const provider = await this.prisma.provider.findUniqueOrThrow({
      where: { id: providerId },
      select: {
        state: true,
        district: true,
        categories: { where: { removedAt: null }, select: { category: { select: { key: true, id: true } } } },
        documents: { where: { inventoryItemId: null, status: { not: "superseded" } }, select: { status: true, expiresOn: true, documentType: { select: { key: true } } } },
      },
    });
    const categoryIds = provider.categories.map((c) => c.category.id);
    const reqs = await this.prisma.documentRequirement.findMany({
      where: {
        categoryId: { in: categoryIds },
        isActive: true,
        documentType: { subject: { in: ["business", "owner"] } },
        AND: [{ OR: [{ state: null }, { state: provider.state }] }, { OR: [{ district: null }, { district: provider.district }] }],
      },
      include: { documentType: true, category: { select: { key: true } } },
    });
    const requirements: DocumentRequirement[] = reqs.map((r) => ({
      documentTypeKey: r.documentType.key,
      label: r.documentType.label,
      categoryKeys: [r.category.key],
      required: r.required,
      requiresExpiry: r.documentType.requiresExpiry,
      subject: r.documentType.subject,
    }));
    return evaluateDocuments(
      requirements,
      provider.documents.map((d) => ({ documentTypeKey: d.documentType.key, status: d.status, expiresOn: toDate(d.expiresOn) })),
      provider.categories.map((c) => c.category.key),
      istDateOf(new Date()),
    );
  }

  private async load(providerId: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { id: true, status: true, deletedAt: true } });
    if (!provider || provider.deletedAt) throw ApiError.notFound("Provider");
    return provider;
  }

  private businessData(input: ProviderBusinessInput) {
    return {
      legalName: input.legalName,
      displayName: input.displayName,
      businessType: input.businessType,
      description: input.description,
      registrationNumber: input.registrationNumber ?? null,
      gstin: input.gstin ?? null,
      contactEmail: input.contactEmail.toLowerCase(),
      contactPhone: input.contactPhone,
      website: input.website ?? null,
      addressLine1: input.address.line1,
      addressLine2: input.address.line2 ?? null,
      city: input.address.city,
      district: input.address.district,
      state: input.address.state,
      pincode: input.address.pincode,
    };
  }
}
