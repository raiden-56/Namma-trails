import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SERVICE_CATEGORY_KEYS, localDate, slug } from "@kt/domain";
import { z } from "zod";
import { Public } from "../../common/auth/principal.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { BookingsService } from "./bookings.service.js";
import { priceUnitLabel, toLocalDateString } from "./support.js";

export const bookingRequestSchema = z.object({
  serviceSlug: slug,
  inventoryItemId: z.uuid().optional(),
  slotId: z.uuid().optional(),
  mode: z.enum(["shared", "private"]).optional(),
  date: localDate.optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkIn: localDate.optional(),
  checkOut: localDate.optional(),
  pickupAt: z.iso.datetime({ offset: true }).optional(),
  returnAt: z.iso.datetime({ offset: true }).optional(),
  units: z.coerce.number().int().min(1).max(20).optional(),
  adults: z.coerce.number().int().min(0).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  routeId: z.string().max(40).optional(),
  couponCode: z.string().trim().max(32).optional(),
});

const searchSchema = z.object({
  destination: slug.optional(),
  categories: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((c): c is (typeof SERVICE_CATEGORY_KEYS)[number] => (SERVICE_CATEGORY_KEYS as readonly string[]).includes(c)) : undefined)),
  q: z.string().trim().max(120).optional(),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  minPricePaise: z.coerce.number().int().min(0).optional(),
  maxPricePaise: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating", "newest"]).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export const mediaUrl = (m: { bucket: string; objectKey: string }) => (m.bucket === "static" ? m.objectKey : `/media/${m.objectKey}`);

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async search(q: z.infer<typeof searchSchema>) {
    const where: Prisma.ServiceWhereInput = {
      ...this.catalog.bookableServiceWhere(),
      ...(q.destination ? { destination: { slug: q.destination, status: "active" } } : {}),
      ...(q.categories?.length ? { category: { key: { in: q.categories } } } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { summary: { contains: q.q, mode: "insensitive" } }] } : {}),
      ...(q.guests ? { OR: [{ maxParticipants: null }, { maxParticipants: { gte: q.guests } }] } : {}),
      ...(q.minPricePaise !== undefined || q.maxPricePaise !== undefined
        ? { fromPrice: { ...(q.minPricePaise !== undefined ? { gte: q.minPricePaise } : {}), ...(q.maxPricePaise !== undefined ? { lte: q.maxPricePaise } : {}) } }
        : {}),
      ...(q.minRating ? { ratingAvg: { gte: q.minRating } } : {}),
    };
    const orderBy: Prisma.ServiceOrderByWithRelationInput[] =
      q.sort === "price_asc"
        ? [{ fromPrice: "asc" }]
        : q.sort === "price_desc"
          ? [{ fromPrice: "desc" }]
          : q.sort === "rating"
            ? [{ ratingAvg: { sort: "desc", nulls: "last" } }]
            : q.sort === "newest"
              ? [{ publishedAt: "desc" }]
              : [{ isFeatured: "desc" }, { ratingCount: "desc" }, { publishedAt: "desc" }];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          category: { select: { key: true, name: true } },
          destination: { select: { slug: true, name: true } },
          provider: { select: { displayName: true, status: true } },
          pricePlans: { where: { isActive: true }, select: { model: true }, take: 1 },
          media: { where: { isCover: true }, include: { media: true }, take: 1 },
        },
      }),
    ]);
    return {
      data: rows.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        summary: s.summary,
        category: s.category.key,
        categoryName: s.category.name,
        destinationSlug: s.destination.slug,
        destinationName: s.destination.name,
        providerName: s.provider.displayName,
        providerVerified: s.provider.status === "approved",
        fromPricePaise: s.fromPrice,
        priceUnitLabel: s.pricePlans[0] ? priceUnitLabel(s.pricePlans[0].model) : null,
        ratingAverage: s.ratingAvg ? Number(s.ratingAvg) : null,
        ratingCount: s.ratingCount,
        coverImageUrl: s.media[0] ? mediaUrl(s.media[0].media) : null,
        confirmationPolicy: s.confirmationPolicy,
        isDemo: s.isDemo,
      })),
      meta: { page: q.page, pageSize: q.pageSize, total },
    };
  }

  async detail(serviceSlug: string) {
    const s = await this.prisma.service.findFirst({
      where: { slug: serviceSlug, ...this.catalog.bookableServiceWhere() },
      include: {
        category: true,
        destination: { select: { slug: true, name: true, district: true } },
        provider: { select: { id: true, slug: true, displayName: true, status: true, ratingAvg: true, ratingCount: true, description: true, approvedAt: true } },
        cancellationPolicy: true,
        media: { include: { media: true }, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
        locations: { orderBy: { sortOrder: "asc" }, select: { kind: true, name: true, addressLine: true, instructions: true } },
        inventoryItems: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true, totalUnits: true, attributes: true, tags: true } },
        pricePlans: { where: { isActive: true }, select: { id: true, inventoryItemId: true, model: true, baseAmount: true, childAmount: true, depositPerUnit: true, extraAdultAmount: true, perKmAmount: true, minimumFare: true } },
        reviews: { where: { status: "published" }, orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { profile: { select: { fullName: true } } } } } },
      },
    });
    if (!s) return null;
    await this.prisma.service.update({ where: { id: s.id }, data: { viewCount: { increment: 1 } } });
    const attrs = (s.attributes ?? {}) as { routes?: { id: string; name: string; km: number; durationMinutes?: number }[]; [k: string]: unknown };
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      description: s.description,
      highlights: s.highlights,
      inclusions: s.inclusions,
      exclusions: s.exclusions,
      languages: s.languages,
      durationMinutes: s.durationMinutes,
      minParticipants: s.minParticipants,
      maxParticipants: s.maxParticipants,
      minAge: s.minAge,
      safetyInfo: s.safetyInfo,
      weatherDependent: s.weatherDependent,
      requiresLicence: s.requiresLicence,
      confirmationPolicy: s.confirmationPolicy,
      minLeadMinutes: s.minLeadMinutes,
      isDemo: s.isDemo,
      category: { key: s.category.key, name: s.category.name, bookingModel: s.category.bookingModel },
      destination: s.destination,
      provider: {
        slug: s.provider.slug,
        name: s.provider.displayName,
        verified: s.provider.status === "approved",
        verifiedSince: s.provider.approvedAt,
        description: s.provider.description,
        ratingAverage: s.provider.ratingAvg ? Number(s.provider.ratingAvg) : null,
        ratingCount: s.provider.ratingCount,
      },
      rating: { average: s.ratingAvg ? Number(s.ratingAvg) : null, count: s.ratingCount },
      fromPricePaise: s.fromPrice,
      priceUnitLabel: s.pricePlans[0] ? priceUnitLabel(s.pricePlans[0].model) : null,
      cancellationPolicy: s.cancellationPolicy ? { name: s.cancellationPolicy.name, summary: s.cancellationPolicy.summary } : null,
      images: s.media.map((m) => ({ url: mediaUrl(m.media), alt: m.media.altText ?? s.title, caption: m.caption })),
      locations: s.locations,
      options: s.inventoryItems.map((i) => {
        const plan = s.pricePlans.find((p) => p.inventoryItemId === i.id) ?? s.pricePlans.find((p) => p.inventoryItemId === null);
        return { id: i.id, name: i.name, capacity: i.capacity, units: i.totalUnits, tags: i.tags, attributes: i.attributes, pricePaise: plan?.baseAmount ?? null, depositPaise: plan?.depositPerUnit ?? null, priceUnitLabel: plan ? priceUnitLabel(plan.model) : null };
      }),
      routes: (attrs.routes ?? []).map((r) => {
        const plan = s.pricePlans[0];
        const fare = plan ? Math.max((plan.baseAmount ?? 0) + (plan.perKmAmount ?? 0) * Math.ceil(r.km), plan.minimumFare ?? 0) : null;
        return { ...r, farePaise: fare };
      }),
      reviews: s.reviews.map((r) => ({ rating: r.rating, title: r.title, body: r.body, author: r.user.profile?.fullName?.split(" ")[0] ?? "Traveller", createdAt: r.createdAt, response: r.response })),
    };
  }

  async slots(serviceSlug: string, date: string) {
    const s = await this.prisma.service.findFirst({ where: { slug: serviceSlug, ...this.catalog.bookableServiceWhere() }, select: { id: true, minLeadMinutes: true } });
    if (!s) return [];
    const now = new Date();
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { inventoryItem: { serviceId: s.id, isActive: true }, date: new Date(`${date}T00:00:00Z`) },
      orderBy: { startsAt: "asc" },
      include: { inventoryItem: { select: { name: true } }, reservations: { where: { kind: "hold", releasedAt: null, expiresAt: { gt: now } }, select: { units: true } } },
    });
    return slots.map((slot) => {
      const held = slot.reservations.reduce((a, r) => a + r.units, 0);
      const bookableFrom = new Date(now.getTime() + s.minLeadMinutes * 60_000);
      return {
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        date: toLocalDateString(slot.date),
        boat: slot.inventoryItem.name,
        capacity: slot.capacity,
        remaining: slot.privatelyBooked ? 0 : Math.max(0, slot.capacity - slot.committed - held),
        status: slot.status,
        bookable: slot.status === "open" && slot.startsAt > bookableFrom,
      };
    });
  }
}

@ApiTags("marketplace")
@Public()
@Controller({ version: "1" })
export class MarketplaceController {
  constructor(
    private readonly market: MarketplaceService,
    private readonly bookings: BookingsService,
  ) {}

  @Get("search/services")
  @ApiOperation({ summary: "Search bookable services (published, verified partners, active destinations)" })
  search(@Query(new ZodPipe(searchSchema)) q: z.infer<typeof searchSchema>) {
    return this.market.search(q);
  }

  @Get("services/:slug")
  async detail(@Param("slug", new ZodPipe(slug)) serviceSlug: string) {
    const data = await this.market.detail(serviceSlug);
    if (!data) return this.bookings.notFound();
    return { data };
  }

  @Get("services/:slug/slots")
  async slots(@Param("slug", new ZodPipe(slug)) serviceSlug: string, @Query("date", new ZodPipe(localDate)) date: string) {
    return { data: await this.market.slots(serviceSlug, date) };
  }

  @Post("bookings/quote")
  @HttpCode(200)
  @ApiOperation({ summary: "Server-computed, line-itemised quote with live availability" })
  async quote(@Body(new ZodPipe(bookingRequestSchema)) body: z.infer<typeof bookingRequestSchema>) {
    return { data: await this.bookings.quote(body) };
  }
}
