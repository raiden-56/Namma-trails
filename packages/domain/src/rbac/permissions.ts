/**
 * Permission catalog. Platform permissions are global; `org.*` permissions are
 * always evaluated against a specific provider organisation, so holding
 * `org.booking.read` for provider A never grants it for provider B.
 *
 * Roles are seeded from DEFAULT_ROLE_PERMISSIONS into the roles /
 * role_permissions tables; admins can adjust them at runtime. The API checks
 * permissions, never role names.
 */
export const PLATFORM_PERMISSIONS = [
  "admin.dashboard.view",
  "provider.application.read",
  "provider.application.review",
  "provider.document.read_private",
  "provider.document.verify",
  "provider.suspend",
  "destination.manage",
  "destination.publish",
  "category.manage",
  "listing.read_any",
  "listing.moderate",
  "booking.read_any",
  "booking.manage_any",
  "refund.approve",
  "dispute.resolve",
  "finance.read",
  "finance.commission.manage",
  "finance.payout.manage",
  "user.read",
  "user.manage",
  "user.suspend",
  "role.manage",
  "cms.manage",
  "support.ticket.read_any",
  "support.ticket.manage",
  "incident.manage",
  "settings.manage",
  "feature_flag.manage",
  "audit.read",
] as const;

export const ORG_PERMISSIONS = [
  "org.profile.read",
  "org.profile.update",
  "org.documents.manage",
  "org.staff.manage",
  "org.listing.read",
  "org.listing.manage",
  "org.listing.submit",
  "org.inventory.manage",
  "org.booking.read",
  "org.booking.read_assigned",
  "org.booking.manage",
  "org.customer_contact.read",
  "org.finance.read",
  "org.payout_account.manage",
  "org.reviews.respond",
] as const;

export const SELF_PERMISSIONS = [
  "self.profile.manage",
  "self.booking.create",
  "self.booking.read",
  "self.booking.cancel",
  "self.review.create",
  "self.support.create",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type OrgPermission = (typeof ORG_PERMISSIONS)[number];
export type SelfPermission = (typeof SELF_PERMISSIONS)[number];
export type Permission = PlatformPermission | OrgPermission | SelfPermission;

export const PLATFORM_ROLES = [
  "super_admin",
  "operations_admin",
  "verification_admin",
  "finance_admin",
  "support_admin",
  "traveler",
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Roles a user can hold inside one provider organisation. */
export const ORG_ROLES = ["owner", "manager", "front_desk", "booking_coordinator", "accountant", "operator"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

const ALL_PLATFORM = [...PLATFORM_PERMISSIONS];
const SELF = [...SELF_PERMISSIONS];

export const DEFAULT_PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly (PlatformPermission | SelfPermission)[]> = {
  super_admin: ALL_PLATFORM,
  operations_admin: [
    "admin.dashboard.view",
    "provider.application.read",
    "destination.manage",
    "destination.publish",
    "category.manage",
    "listing.read_any",
    "listing.moderate",
    "booking.read_any",
    "booking.manage_any",
    "user.read",
    "cms.manage",
    "incident.manage",
    "audit.read",
  ],
  verification_admin: [
    "admin.dashboard.view",
    "provider.application.read",
    "provider.application.review",
    "provider.document.read_private",
    "provider.document.verify",
    "provider.suspend",
    "listing.read_any",
    "listing.moderate",
    "audit.read",
  ],
  finance_admin: [
    "admin.dashboard.view",
    "booking.read_any",
    "refund.approve",
    "finance.read",
    "finance.commission.manage",
    "finance.payout.manage",
    "audit.read",
  ],
  support_admin: [
    "admin.dashboard.view",
    "booking.read_any",
    "user.read",
    "support.ticket.read_any",
    "support.ticket.manage",
    "incident.manage",
    "dispute.resolve",
  ],
  traveler: SELF,
};

export const DEFAULT_ORG_ROLE_PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
  owner: [...ORG_PERMISSIONS],
  manager: [
    "org.profile.read",
    "org.profile.update",
    "org.documents.manage",
    "org.listing.read",
    "org.listing.manage",
    "org.listing.submit",
    "org.inventory.manage",
    "org.booking.read",
    "org.booking.manage",
    "org.customer_contact.read",
    "org.reviews.respond",
  ],
  front_desk: ["org.profile.read", "org.listing.read", "org.booking.read", "org.booking.manage", "org.customer_contact.read"],
  booking_coordinator: [
    "org.profile.read",
    "org.listing.read",
    "org.inventory.manage",
    "org.booking.read",
    "org.booking.manage",
    "org.customer_contact.read",
  ],
  accountant: ["org.profile.read", "org.finance.read", "org.booking.read"],
  /** Boat operator, driver or guide: sees only bookings assigned to them. */
  operator: ["org.booking.read_assigned"],
};

export interface Principal {
  userId: string;
  /** Effective platform permissions (resolved from the user's platform roles). */
  platformPermissions: ReadonlySet<string>;
  /** Effective permissions per provider organisation the user belongs to (active memberships only). */
  orgPermissions: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface ResourceRef {
  providerId?: string | null;
  ownerUserId?: string | null;
  assignedUserId?: string | null;
}

/**
 * Authorization decision. Called by API guards and services. Platform
 * permissions apply to any resource; org permissions only to resources of
 * that organisation; self permissions only to resources the user owns.
 */
export function can(principal: Principal, permission: Permission, resource?: ResourceRef): boolean {
  if (permission.startsWith("org.")) {
    const providerId = resource?.providerId;
    if (!providerId) return false;
    const perms = principal.orgPermissions.get(providerId);
    if (!perms) return false;
    if (perms.has(permission)) return true;
    // Operators may read bookings assigned to them.
    if (permission === "org.booking.read" && perms.has("org.booking.read_assigned")) {
      return resource?.assignedUserId === principal.userId;
    }
    return false;
  }
  if (permission.startsWith("self.")) {
    if (!principal.platformPermissions.has(permission)) return false;
    return resource?.ownerUserId == null || resource.ownerUserId === principal.userId;
  }
  return principal.platformPermissions.has(permission);
}
