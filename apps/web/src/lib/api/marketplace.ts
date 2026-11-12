import { api } from "./client";
import type { Paginated } from "./endpoints";
import type { BookingStatus, ListingStatus, ServiceCategoryKey } from "@/lib/catalog";

/*
 * Typed client for the marketplace, booking, partner and admin-operations APIs
 * (apps/api/src/modules/bookings/*, admin-ops.controller.ts). Money is integer paise;
 * instants are ISO strings; calendar dates are "YYYY-MM-DD" (IST).
 */

/* ───────────── public marketplace ───────────── */

export interface ServiceCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: ServiceCategoryKey;
  categoryName: string;
  destinationSlug: string;
  destinationName: string;
  providerName: string;
  providerVerified: boolean;
  fromPricePaise: number | null;
  priceUnitLabel: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  coverImageUrl: string | null;
  confirmationPolicy: "instant" | "request";
  isDemo: boolean;
}

export type BookingModel = "slot_capacity" | "nightly_inventory" | "time_range_rental" | "assigned_trip" | "assigned_person" | "package";

export interface ServiceDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  languages: string[];
  durationMinutes: number | null;
  minParticipants: number;
  maxParticipants: number | null;
  minAge: number | null;
  safetyInfo: string | null;
  weatherDependent: boolean;
  requiresLicence: boolean;
  confirmationPolicy: "instant" | "request";
  minLeadMinutes: number;
  isDemo: boolean;
  category: { key: ServiceCategoryKey; name: string; bookingModel: BookingModel };
  destination: { slug: string; name: string; district: string };
  provider: { slug: string; name: string; verified: boolean; verifiedSince: string | null; description: string | null; ratingAverage: number | null; ratingCount: number };
  rating: { average: number | null; count: number };
  fromPricePaise: number | null;
  priceUnitLabel: string | null;
  cancellationPolicy: { name: string; summary: string } | null;
  images: { url: string; alt: string; caption: string | null }[];
  locations: { kind: string; name: string; addressLine: string | null; instructions: string | null }[];
  /** Rooms (stays), vehicle models (rentals), boats, cabs or guides. */
  options: { id: string; name: string; capacity: number; units: number; tags: string[]; attributes: unknown; pricePaise: number | null; depositPaise: number | null; priceUnitLabel: string | null }[];
  /** Taxi routes defined by the operator. */
  routes: { id: string; name: string; km: number; durationMinutes?: number; farePaise: number | null }[];
  reviews: { rating: number; title: string | null; body: string | null; author: string; createdAt: string; response: string | null }[];
}

export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  date: string;
  boat: string;
  capacity: number;
  remaining: number;
  status: "open" | "closed" | "weather_hold";
  bookable: boolean;
}

/** What the traveller chose. Which fields apply depends on the category's booking model. */
export interface BookingRequest {
  serviceSlug: string;
  inventoryItemId?: string; // stays, rentals
  slotId?: string; // slot_capacity
  mode?: "shared" | "private";
  date?: string; // taxis, guides
  startTime?: string; // "HH:mm" IST, taxis and guides
  checkIn?: string;
  checkOut?: string;
  pickupAt?: string; // ISO with offset, e.g. "2026-12-01T09:00:00+05:30"
  returnAt?: string;
  units?: number;
  adults?: number;
  children?: number;
  routeId?: string;
  couponCode?: string;
}

export interface QuoteLine {
  kind: "base" | "seasonal" | "extra_guest" | "discount" | "tax" | "fee" | "fee_tax" | "deposit";
  label: string;
  amount: number;
}

export interface QuoteResult {
  service: { slug: string; title: string; confirmationPolicy: "instant" | "request" };
  startsAt: string;
  endsAt: string;
  route: { id: string; name: string; km: number } | null;
  availability: { available: boolean; remaining: number; reason?: string };
  quote: { lines: QuoteLine[]; total: number; serviceSubtotal: number; discount: number; serviceTax: number; platformFee: number; deposit: number; billable: { quantity: number; unit: string } };
}

export interface BookingCreated {
  bookingId: string;
  reference: string;
  tripReference: string;
  status: BookingStatus;
  total: number;
  holdExpiresAt: string;
  /** Present for instant bookings: complete it to confirm the booking. */
  payment: { id: string; gatewayOrderId: string; amount: number } | null;
}

export const market = {
  search: (query: { destination?: string; categories?: string; q?: string; guests?: number; minPricePaise?: number; maxPricePaise?: number; minRating?: number; sort?: string; page?: number; pageSize?: number }) =>
    api.get<Paginated<ServiceCard>>("/search/services", { query }),
  service: (slug: string) => api.get<{ data: ServiceDetail }>(`/services/${slug}`),
  slots: (slug: string, date: string) => api.get<{ data: Slot[] }>(`/services/${slug}/slots`, { query: { date } }),
  quote: (req: BookingRequest) => api.post<{ data: QuoteResult }>("/bookings/quote", req),
};

/* ───────────── traveller ───────────── */

export interface TripBooking {
  id: string;
  reference: string;
  tripReference: string;
  status: BookingStatus;
  service: { slug: string; title: string; category: string; categoryKey: ServiceCategoryKey; destination: string; coverImageUrl: string | null };
  provider: { name: string };
  startsAt: string;
  endsAt: string;
  units: number;
  adults: number;
  children: number;
  totalPaise: number;
  refundedPaise: number;
  confirmationPolicy: "instant" | "request";
  holdExpiresAt: string | null;
  pendingPayment: { id: string; amountPaise: number } | null;
  reviewed: boolean;
  createdAt: string;
}

export interface RefundPreview {
  refundBps: number;
  total: number;
  serviceRefund: number;
  serviceTaxRefund: number;
  platformFeeRefund: number;
  depositRefund: number;
  reason: string;
}

export interface BookingDetail extends Omit<TripBooking, "provider"> {
  quote: QuoteResult["quote"];
  request: BookingRequest & { route?: { name: string; km: number } };
  guests: { fullName: string; isLead: boolean }[];
  provider: { name: string; phone: string | null };
  locations: { kind: string; name: string; addressLine: string | null; instructions: string | null }[];
  safetyInfo: string | null;
  cancellationPolicy: { tiers: { minHoursBeforeStart: number; refundBps: number }[]; platformFeeRefundable: boolean };
  cancellable: boolean;
  refundPreview: RefundPreview | null;
  refunds: { amountPaise: number; status: string; createdAt: string; reason: string | null }[];
  history: { status: BookingStatus; event: string; at: string; note: string | null }[];
  canReview: boolean;
}

export const traveler = {
  book: (body: BookingRequest & { guests?: { fullName: string; phone?: string }[]; specialRequests?: string }, idempotencyKey: string) =>
    api.post<{ data: BookingCreated }>("/bookings", body, { idempotencyKey }),
  /** DEVELOPMENT ONLY: stands in for the payment gateway (Razorpay in production). */
  completeMockPayment: (paymentId: string, outcome: "success" | "failure") => api.post<{ data: { status: string } }>(`/dev/payments/${paymentId}/complete`, { outcome }),
  trips: () => api.get<{ data: TripBooking[] }>("/me/trips"),
  booking: (reference: string) => api.get<{ data: BookingDetail }>(`/me/bookings/${reference}`),
  cancel: (reference: string, reason: string) => api.post<{ data: { status: BookingStatus; refund: RefundPreview | null } }>(`/me/bookings/${reference}/cancel`, { reason }),
  review: (reference: string, body: { rating: number; title?: string; body?: string }) => api.post<{ data: { id: string } }>(`/me/bookings/${reference}/review`, body),
};

/* ───────────── partner (always scoped to one providerId) ───────────── */

export interface PartnerDashboardData {
  bookingsToday: number;
  upcomingBookings: number;
  pendingRequests: number;
  completedBookings: number;
  cancelledBookings: number;
  earningsThisMonthPaise: number;
  listingViews: number;
  rating: { average: number | null; count: number };
}

export interface PartnerListing {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  category: string;
  destination: string;
  fromPricePaise: number | null;
  priceUnitLabel: string | null;
  rating: { average: number | null; count: number };
  views: number;
  bookings: number;
  inventoryItems: number;
  confirmationPolicy: "instant" | "request";
  coverImageUrl: string | null;
}

export interface PartnerBooking extends TripBooking {
  guest: { name: string; phone: string | null };
  payoutPaise: number | null;
  specialRequests: string | null;
  providerRespondBy: string | null;
}

export interface PartnerFinance {
  grossServiceValuePaise: number;
  commissionPaise: number;
  commissionTaxPaise: number;
  taxCollectedPaise: number;
  refundAdjustmentsPaise: number;
  netEarningsPaise: number;
  pendingSettlementPaise: number;
  paidOutPaise: number;
  payouts: { id: string; periodStart: string; periodEnd: string; amountPaise: number; status: string; paidAt: string | null }[];
  settlements: { reference: string; service: string; startsAt: string; bookingStatus: BookingStatus; bookingTotalPaise: number; commissionPaise: number; netPaise: number; eligible: boolean; paidOut: boolean }[];
}

export type PartnerBookingAction = "accept" | "reject" | "start" | "complete" | "cancel";

export const partner = {
  dashboard: (providerId: string) => api.get<{ data: PartnerDashboardData }>(`/partner/${providerId}/dashboard`),
  listings: (providerId: string) => api.get<{ data: PartnerListing[] }>(`/partner/${providerId}/listings`),
  bookings: (providerId: string, view: "requests" | "upcoming" | "past" | "all") => api.get<{ data: PartnerBooking[] }>(`/partner/${providerId}/bookings`, { query: { view } }),
  act: (providerId: string, reference: string, action: PartnerBookingAction, reason?: string) =>
    api.post<{ data: unknown }>(`/partner/${providerId}/bookings/${reference}/${action}`, reason ? { reason } : {}),
  finance: (providerId: string) => api.get<{ data: PartnerFinance }>(`/partner/${providerId}/finance`),
};

/* ───────────── admin operations ───────────── */

export interface AdminBookingRow {
  reference: string;
  status: BookingStatus;
  service: string;
  category: string;
  destination: string;
  provider: string;
  traveler: string;
  startsAt: string;
  totalPaise: number;
  refundedPaise: number;
  commissionPaise: number | null;
  createdAt: string;
}

export interface AdminFinance {
  paidBookings: number;
  grossBookingValuePaise: number;
  serviceTaxCollectedPaise: number;
  convenienceFeesPaise: number;
  commissionPaise: number;
  commissionTaxPaise: number;
  partnerEarningsPaise: number;
  refundsPaise: number;
  refundCount: number;
  payoutsByStatus: { status: string; count: number; amountPaise: number }[];
  byCategory: { category: string; bookings: number; gbvPaise: number; commissionPaise: number }[];
  payouts: { id: string; provider: string; periodStart: string; periodEnd: string; amountPaise: number; status: string; paidAt: string | null }[];
}

export interface AdminTicketRow {
  reference: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending_customer" | "pending_provider" | "escalated" | "resolved" | "closed";
  requester: string;
  assignee: string | null;
  bookingReference: string | null;
  provider: string | null;
  messages: number;
  createdAt: string;
}

export interface AdminTicketDetail {
  reference: string;
  subject: string;
  category: string;
  priority: AdminTicketRow["priority"];
  status: AdminTicketRow["status"];
  incident: Record<string, unknown> | null;
  requester: { name: string | null; email: string | null; phone: string | null };
  booking: { reference: string; status: BookingStatus } | null;
  provider: string | null;
  createdAt: string;
  messages: { body: string; internal: boolean; author: string; createdAt: string }[];
}

export type ListingDecision = "approve" | "publish" | "request_changes" | "reject" | "pause";

export const adminOps = {
  bookings: (query: { status?: BookingStatus; q?: string; page?: number; pageSize?: number } = {}) => api.get<Paginated<AdminBookingRow>>("/admin/bookings", { query }),
  finance: () => api.get<{ data: AdminFinance }>("/admin/finance"),
  tickets: (query: { status?: AdminTicketRow["status"]; page?: number } = {}) => api.get<Paginated<AdminTicketRow>>("/admin/support/tickets", { query }),
  ticket: (reference: string) => api.get<{ data: AdminTicketDetail }>(`/admin/support/tickets/${reference}`),
  decideListing: (serviceId: string, decision: ListingDecision, message?: string) =>
    api.post<{ data: { id: string; status: ListingStatus } }>(`/admin/listings/${serviceId}/decision`, { decision, ...(message ? { message } : {}) }),
  decideDocument: (documentId: string, decision: "verify" | "reject", reason?: string) =>
    api.post<{ data: { id: string; status: string } }>(`/admin/documents/${documentId}/decision`, { decision, ...(reason ? { reason } : {}) }),
};
