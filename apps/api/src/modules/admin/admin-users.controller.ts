import { Controller, Get, Injectable, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PLATFORM_ROLES, paginationSchema } from "@kt/domain";
import { z } from "zod";
import { RequirePermissions } from "../../common/auth/principal.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

const usersQuery = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  role: z.enum(PLATFORM_ROLES).optional(),
  /** Only users who belong to at least one provider organisation. */
  partnersOnly: z.enum(["true", "false"]).optional(),
  status: z.enum(["active", "pending_verification", "suspended", "deleted"]).optional(),
});
type UsersQuery = z.infer<typeof usersQuery>;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UsersQuery) {
    const and: Prisma.UserWhereInput[] = [];
    if (query.q) {
      const digits = query.q.replace(/\D/g, "");
      and.push({
        OR: [
          { email: { contains: query.q, mode: "insensitive" } },
          { profile: { fullName: { contains: query.q, mode: "insensitive" } } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      });
    }
    if (query.role) and.push({ roles: { some: { role: { key: query.role } } } });
    if (query.partnersOnly === "true") and.push({ memberships: { some: { status: "active" } } });
    and.push(query.status ? { status: query.status } : { status: { not: "deleted" } });
    const where: Prisma.UserWhereInput = { AND: and };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          phoneVerified: true,
          isDemo: true,
          profile: { select: { fullName: true } },
          roles: { select: { role: { select: { key: true, name: true } } } },
          memberships: {
            where: { status: "active" },
            select: { role: true, provider: { select: { id: true, displayName: true, status: true } } },
          },
        },
      }),
    ]);

    return {
      data: rows.map((u) => ({
        id: u.id,
        fullName: u.profile?.fullName ?? null,
        email: u.email,
        phone: u.phone,
        phoneVerified: Boolean(u.phoneVerified),
        status: u.status,
        isDemo: u.isDemo,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        roles: u.roles.map((r) => ({ key: r.role.key, name: r.role.name })),
        providers: u.memberships.map((m) => ({ id: m.provider.id, displayName: m.provider.displayName, status: m.provider.status, role: m.role })),
      })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  /** Every figure is a live count or sum; zero means zero, never "not wired". */
  async overview() {
    const p = this.prisma;
    const [users, providers, pending, approved, suspended, activeDestinations, activeServices, bookings, confirmed, cancelled, gbv, revenue, refunds] =
      await p.$transaction([
        p.user.count({ where: { status: { not: "deleted" } } }),
        p.provider.count({ where: { deletedAt: null } }),
        p.provider.count({ where: { deletedAt: null, status: { in: ["submitted", "under_review"] } } }),
        p.provider.count({ where: { deletedAt: null, status: "approved" } }),
        p.provider.count({ where: { deletedAt: null, status: "suspended" } }),
        p.destination.count({ where: { status: "active" } }),
        p.service.count({ where: { status: "published", deletedAt: null } }),
        p.booking.count(),
        p.booking.count({ where: { status: { in: ["confirmed", "in_progress", "completed"] } } }),
        p.booking.count({ where: { status: { in: ["cancelled", "refunded", "partially_refunded", "refund_pending"] } } }),
        p.booking.aggregate({ _sum: { total: true }, where: { status: { in: ["confirmed", "in_progress", "completed"] } } }),
        p.bookingSettlement.aggregate({ _sum: { commission: true } }),
        p.refund.aggregate({ _sum: { amount: true }, where: { status: "succeeded" } }),
      ]);
    return {
      marketplace: { users, providers, pendingApplications: pending, approvedProviders: approved, suspendedProviders: suspended, activeDestinations, activeServices },
      bookings: {
        total: bookings,
        confirmed,
        cancelled,
        grossBookingValuePaise: gbv._sum.total ?? 0,
        platformRevenuePaise: revenue._sum.commission ?? 0,
        refundsPaise: refunds._sum.amount ?? 0,
      },
    };
  }
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller({ path: "admin", version: "1" })
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get("users")
  @RequirePermissions("user.read")
  @ApiOperation({ summary: "Search users (name, email, phone), filter by platform role, partners only or status" })
  list(@Query(new ZodPipe(usersQuery)) query: UsersQuery) {
    return this.users.list(query);
  }

  @Get("overview")
  @RequirePermissions("admin.dashboard.view")
  @ApiOperation({ summary: "Live marketplace KPIs for the admin dashboard" })
  async overview() {
    return { data: await this.users.overview() };
  }
}
