import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BedDouble,
  CalendarCheck,
  Compass,
  FileCheck2,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Map,
  MapPinned,
  Settings,
  ShieldCheck,
  Store,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { categoryShelves } from "./categories";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Not yet routable — rendered disabled with a hint, never as a dead link. */
  pending?: boolean;
  /** Why it is not available yet, and which phase delivers it. */
  pendingReason?: string;
  /** Short label shown in place of the link, e.g. "Phase 5". */
  pendingTag?: string;
}

export const publicNav: NavItem[] = [
  { label: "Destinations", href: "/destinations" },
  ...categoryShelves.map((s) => ({ label: s.label, href: s.href })),
];

/** Editorial pages that sit beside the bookable categories. */
export const publicEditorialNav: NavItem[] = [{ label: "Blog", href: "/blog" }];

export const publicUtilityNav: NavItem[] = [
  { label: "My Trips", href: "/trips" },
  { label: "Become a Partner", href: "/partner/join" },
];

export const travelerNav: NavItem[] = [
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Trips", href: "/trips", icon: Map },
  { label: "Saved", href: "/saved", icon: Heart },
  { label: "Account", href: "/account", icon: User },
];

export const partnerNav: NavItem[] = [
  { label: "Dashboard", href: "/partner", icon: LayoutDashboard },
  { label: "Documents", href: "/partner/verification", icon: ShieldCheck, pending: true, pendingTag: "Phase 3", pendingReason: "Secure document upload is the next piece of Phase 3. Your required documents are listed on the dashboard." },
  { label: "Listings", href: "/partner/listings", icon: BedDouble },
  { label: "Bookings", href: "/partner/bookings", icon: CalendarCheck },
  { label: "Team", href: "/partner/team", icon: Users, pending: true, pendingTag: "Phase 3", pendingReason: "Inviting staff (managers, front desk, drivers) completes Phase 3." },
  { label: "Finance", href: "/partner/finance", icon: Wallet },
  { label: "Support", href: "/partner/support", icon: LifeBuoy, pending: true, pendingTag: "Phase 7", pendingReason: "Partner support tickets are built in Phase 7." },
];

export const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: BarChart3 },
  { label: "Provider applications", href: "/admin/providers", icon: FileCheck2 },
  { label: "Destinations", href: "/admin/destinations", icon: MapPinned },
  { label: "Listings", href: "/admin/listings", icon: Store },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
  { label: "Finance", href: "/admin/finance", icon: Wallet },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Settings", href: "/admin/settings", icon: Settings, pending: true, pendingTag: "Phase 8", pendingReason: "Commission rules, tax rules, feature flags and templates are built in Phase 8." },
];

export const PENDING_HINT = "Available after launch setup";
