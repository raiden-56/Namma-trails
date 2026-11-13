import { Body, Controller, Get, HttpStatus, Injectable, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DESTINATION_STATUSES, LISTING_STATUSES, type Principal, paginationSchema, slug } from "@kt/domain";
import { z } from "zod";
import { AuditService } from "../../common/audit/audit.service.js";
import { CurrentPrincipal, RequirePermissions } from "../../common/auth/principal.js";
import { ApiError } from "../../common/errors/api-error.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { DestinationStatus } from "../../generated/prisma/client.js";

/** Destination launch lifecycle (docs/10): draft ⇄ onboarding → active ⇄ temporarily_unavailable. */
const DESTINATION_TRANSITIONS: Record<DestinationStatus, DestinationStatus[]> = {
  draft: ["onboarding"],
  onboarding: ["active", "draft"],
  active: ["temporarily_unavailable"],
  temporarily_unavailable: ["active"],
};

const destinationUpdate = z
  .object({
    status: z.enum(DESTINATION_STATUSES).optional(),
    isFeatured: z.boolean().optional(),
    /** Required when taking a destination offline, shown in the audit log. */
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.status !== undefined || v.isFeatured !== undefined, { message: "Nothing to update" });

const listingsQuery = paginationSchema.extend({
  status: z.enum(LISTING_STATUSES).optional(),
  destination: slug.optional(),
  q: z.string().trim().max(120).optional(),
});

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async destinations() {
    const [rows, approvedByDest, listingsByDest, applicantsByDest] = await Promise.all([
      this.prisma.destination.findMany({
        orderBy: [{ launchPhase: "asc" }, { sortOrder: "asc" }],
        include: { categories: { include: { category: { select: { key: true, name: true } } } } },
      }),
      this.prisma.providerDestination.groupBy({ by: ["destinationId"], where: { removedAt: null, provider: { status: "approved", deletedAt: null } }, _count: { _all: true } }),
      this.prisma.service.groupBy({ by: ["destinationId"], where: { status: "published", deletedAt: null }, _count: { _all: true } }),
      this.prisma.providerDestination.groupBy({ by: ["destinationId"], where: { removedAt: null, provider: { deletedAt: null } }, _count: { _all: true } }),
    ]);
    const count = (list: { destinationId: string; _count: { _all: number } }[], id: string) => list.find((r) => r.destinationId === id)?._count._all ?? 0;
    return rows.map((d) => ({
      slug: d.slug,
      name: d.name,
      district: d.district,
      status: d.status,
      isFeatured: d.isFeatured,
      launchPhase: d.launchPhase,
      launchedAt: d.launchedAt,
      readiness: {
        partnerApplications: count(applicantsByDest, d.id),
        approvedPartners: count(approvedByDest, d.id),
        publishedListings: count(listingsByDest, d.id),
      },
      categories: d.categories.map((c) => ({ key: c.category.key, name: c.category.name, enabled: c.isEnabled })),
      allowedStatuses: DESTINATION_TRANSITIONS[d.status],
    }));
  }

  async updateDestination(principal: Principal, destinationSlug: string, input: z.infer<typeof destinationUpdate>) {
    const d = await this.prisma.destination.findUnique({ where: { slug: destinationSlug } });
    if (!d) throw ApiError.notFound("Destination");
    if (input.status && input.status !== d.status && !DESTINATION_TRANSITIONS[d.status].includes(input.status)) {
      throw ApiError.conflict("DESTINATION_INVALID_TRANSITION", `A destination cannot move from ${d.status} to ${input.status}`);
    }
    if (input.status === "temporarily_unavailable" && !input.reason) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "REASON_REQUIRED", "Give a reason when taking a destination offline");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.destination.update({
        where: { id: d.id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.status === "active" && !d.launchedAt ? { launchedAt: new Date() } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
        },
      });
      await this.audit.record(
        {
          actorId: principal.userId,
          actorType: "admin",
          action: input.status && input.status !== d.status ? "destination.status.change" : "destination.update",
          entityType: "destination",
          entityId: d.id,
          before: { status: d.status, isFeatured: d.isFeatured },
          after: { status: row.status, isFeatured: row.isFeatured, reason: input.reason ?? null },
        },
        tx,
      );
      return row;
    });
    return { slug: updated.slug, status: updated.status, isFeatured: updated.isFeatured };
  }

  async listings(query: z.infer<typeof listingsQuery>) {
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.destination ? { destination: { slug: query.destination } } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" as const } }, { provider: { displayName: { contains: query.q, mode: "insensitive" as const } } }] } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          fromPrice: true,
          updatedAt: true,
          isDemo: true,
          provider: { select: { displayName: true, status: true } },
          category: { select: { name: true } },
          destination: { select: { name: true } },
        },
      }),
    ]);
    return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
  }
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller({ path: "admin", version: "1" })
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get("destinations")
  @RequirePermissions("destination.manage")
  async destinations() {
    return { data: await this.catalog.destinations() };
  }

  @Patch("destinations/:slug")
  @RequirePermissions("destination.publish")
  @ApiOperation({ summary: "Change a destination's launch status or featured flag (audited)" })
  async updateDestination(
    @CurrentPrincipal() principal: Principal,
    @Param("slug", new ZodPipe(slug)) destinationSlug: string,
    @Body(new ZodPipe(destinationUpdate)) body: z.infer<typeof destinationUpdate>,
  ) {
    return { data: await this.catalog.updateDestination(principal, destinationSlug, body) };
  }

  @Get("listings")
  @RequirePermissions("listing.read_any")
  listings(@Query(new ZodPipe(listingsQuery)) query: z.infer<typeof listingsQuery>) {
    return this.catalog.listings(query);
  }
}
