import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Public catalog. A category is shown as "available" in a destination only
 * when the admin has enabled it AND enough bookable listings exist; inventory
 * counts come from real published services of approved providers.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** The only definition of "publicly bookable" used by read paths. Mirrors publishBlockers() in @kt/domain. */
  bookableServiceWhere(): Prisma.ServiceWhereInput {
    return {
      status: "published",
      deletedAt: null,
      destination: { status: "active" },
      provider: { status: "approved", deletedAt: null, ...(this.env.DEMO_DATA_ENABLED ? {} : { isDemo: false }) },
      ...(this.env.DEMO_DATA_ENABLED ? {} : { isDemo: false }),
    };
  }

  listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true, name: true, slug: true, description: true, icon: true, bookingModel: true },
    });
  }

  private async listingCounts(destinationIds: string[]) {
    const rows = await this.prisma.service.groupBy({
      by: ["destinationId", "categoryId"],
      where: { ...this.bookableServiceWhere(), destinationId: { in: destinationIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [`${r.destinationId}:${r.categoryId}`, r._count._all]));
  }

  async listDestinations() {
    const destinations = await this.prisma.destination.findMany({
      where: { status: { in: ["active", "onboarding", "temporarily_unavailable"] } },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        district: true,
        tagline: true,
        summary: true,
        status: true,
        isFeatured: true,
        launchPhase: true,
        categories: { where: { isEnabled: true }, select: { categoryId: true, minVerifiedListings: true, category: { select: { key: true, name: true } } } },
      },
    });
    const counts = await this.listingCounts(destinations.map((d) => d.id));
    return destinations.map(({ categories, ...d }) => ({
      ...d,
      categories: categories.map((c) => {
        const listings = counts.get(`${d.id}:${c.categoryId}`) ?? 0;
        return { key: c.category.key, name: c.category.name, listings, available: d.status === "active" && listings >= c.minVerifiedListings };
      }),
    }));
  }

  async getDestination(slug: string) {
    const d = await this.prisma.destination.findUnique({
      where: { slug },
      include: {
        attractions: { where: { isPublished: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, summary: true } },
        faqs: { where: { status: "published" }, orderBy: { sortOrder: "asc" }, select: { question: true, answer: true } },
        categories: { where: { isEnabled: true }, include: { category: { select: { key: true, name: true } } } },
      },
    });
    if (!d || d.status === "draft") throw ApiError.notFound("Destination");
    const counts = await this.listingCounts([d.id]);
    return {
      slug: d.slug,
      name: d.name,
      district: d.district,
      state: d.state,
      tagline: d.tagline,
      summary: d.summary,
      content: d.content,
      status: d.status,
      seo: { title: d.seoTitle, description: d.seoDescription },
      attractions: d.attractions,
      faqs: d.faqs,
      categories: d.categories.map((c) => {
        const listings = counts.get(`${d.id}:${c.categoryId}`) ?? 0;
        return { key: c.category.key, name: c.category.name, listings, available: d.status === "active" && listings >= c.minVerifiedListings };
      }),
    };
  }
}
