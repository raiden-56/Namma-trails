import { Injectable } from "@nestjs/common";
import { DEFAULT_ORG_ROLE_PERMISSIONS, can, type OrgPermission, type Permission, type Principal, type ResourceRef } from "@kt/domain";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ApiError } from "../errors/api-error.js";

@Injectable()
export class PrincipalService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves effective permissions from the database. Suspended/deleted users get no principal. */
  async load(userId: string): Promise<Principal | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        roles: { select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } } },
        memberships: {
          where: { status: "active", provider: { deletedAt: null } },
          select: { providerId: true, role: true, extraPermissions: true },
        },
      },
    });
    if (!user || user.status === "suspended" || user.status === "deleted") return null;

    const platformPermissions = new Set<string>();
    for (const ur of user.roles) for (const rp of ur.role.permissions) platformPermissions.add(rp.permission.key);

    const orgPermissions = new Map<string, Set<string>>();
    for (const m of user.memberships) {
      const perms = new Set<string>(DEFAULT_ORG_ROLE_PERMISSIONS[m.role]);
      for (const extra of m.extraPermissions) perms.add(extra);
      orgPermissions.set(m.providerId, perms);
    }
    return { userId: user.id, platformPermissions, orgPermissions };
  }

  /** Throws 401/403 unless the principal may perform `permission` on `resource`. */
  assert(principal: Principal | undefined, permission: Permission, resource?: ResourceRef): asserts principal is Principal {
    if (!principal) throw ApiError.unauthorized();
    if (!can(principal, permission, resource)) throw ApiError.forbidden();
  }

  assertOrg(principal: Principal | undefined, permission: OrgPermission, providerId: string): asserts principal is Principal {
    this.assert(principal, permission, { providerId });
  }
}
