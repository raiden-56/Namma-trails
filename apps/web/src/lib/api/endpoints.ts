import type { ProviderBusinessInput, ProviderCategoriesInput } from "@kt/domain";
import { api } from "./client";
import { setAccessToken } from "./session";
import type { ProviderStatus, ServiceCategoryKey } from "@/lib/catalog";

/* Request/response shapes follow docs/07-api.md. Responses are never mocked here. */

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface ServiceSummary {
  id: string;
  slug: string;
  title: string;
  category: ServiceCategoryKey;
  destinationSlug: string;
  providerName: string;
  providerVerified: boolean;
  /** Price in paise, as returned by the pricing engine for the default quantity. */
  fromPricePaise: number | null;
  priceUnitLabel: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  coverImageUrl: string | null;
}

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface Me {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  roles: string[];
  permissions: string[];
  providers: { id: string; slug: string; displayName: string; status: ProviderStatus; role: string }[];
}

export interface ProviderApplication {
  id: string;
  slug: string;
  displayName: string;
  legalName: string;
  businessType: string;
  status: ProviderStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  documents: { id: string; type: string; label: string; status: string; expiresOn: string | null; rejectionReason: string | null }[];
  /** Provider-visible review history (admin-only internal notes are never included). */
  history: { event: string; fromStatus: ProviderStatus | null; toStatus: ProviderStatus | null; message: string | null; createdAt: string }[];
  categories: { key: ServiceCategoryKey; name: string; status: string }[];
  destinations: { id: string; slug: string; name: string }[];
  requirements: {
    missing: { type: string; label: string }[];
    rejected: { type: string; label: string }[];
    expired: { type: string; label: string }[];
    expiringSoon: { type: string; label: string; expiresOn: string }[];
    readyToSubmit: boolean;
  };
}

export interface AdminUser {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  status: "active" | "pending_verification" | "suspended" | "deleted";
  isDemo: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: { key: string; name: string }[];
  providers: { id: string; displayName: string; status: ProviderStatus; role: string }[];
}

export interface AdminUsersQuery {
  q?: string;
  role?: string;
  partnersOnly?: "true";
  page?: number;
  pageSize?: number;
}

export interface AdminOverview {
  marketplace: {
    users: number;
    providers: number;
    pendingApplications: number;
    approvedProviders: number;
    suspendedProviders: number;
    activeDestinations: number;
    activeServices: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    cancelled: number;
    grossBookingValuePaise: number;
    platformRevenuePaise: number;
    refundsPaise: number;
  };
}

export interface AdminApplication {
  id: string;
  displayName: string;
  businessType: string;
  district: string;
  status: ProviderStatus;
  submittedAt: string | null;
  categories: { key: ServiceCategoryKey; status: string }[];
  pendingDocuments: number;
}

export type ProviderDecision = "start_review" | "approve" | "reject" | "request_info" | "suspend" | "reinstate";

export interface AdminProviderDetail {
  id: string;
  displayName: string;
  legalName: string;
  businessType: string;
  description: string | null;
  registrationNumber: string | null;
  gstin: string | null;
  status: ProviderStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  isDemo: boolean;
  contact: { email: string; phone: string; website: string | null };
  address: { line1: string; line2: string | null; city: string; district: string; state: string; pincode: string };
  owner: { name: string | null; email: string | null; phone: string | null } | null;
  categories: { key: string; name: string; status: string }[];
  destinations: { slug: string; name: string; status: string }[];
  documents: { id: string; type: string; label: string; number: string | null; status: string; expiresOn: string | null; rejectionReason: string | null }[];
  requirements: {
    missing: { type: string; label: string }[];
    pendingReview: { type: string; label: string }[];
    rejected: { type: string; label: string }[];
    expired: { type: string; label: string }[];
    fullyVerified: boolean;
  };
  history: { event: string; fromStatus: ProviderStatus | null; toStatus: ProviderStatus | null; message: string | null; internalNote: string | null; actor: string | null; createdAt: string }[];
  allowedDecisions: ProviderDecision[];
}

export interface AdminDestination {
  slug: string;
  name: string;
  district: string;
  status: "draft" | "onboarding" | "active" | "temporarily_unavailable";
  isFeatured: boolean;
  launchPhase: number;
  launchedAt: string | null;
  readiness: { partnerApplications: number; approvedPartners: number; publishedListings: number };
  categories: { key: string; name: string; enabled: boolean }[];
  allowedStatuses: AdminDestination["status"][];
}

export interface AdminListing {
  id: string;
  title: string;
  status: string;
  fromPrice: number | null;
  updatedAt: string;
  isDemo: boolean;
  provider: { displayName: string; status: ProviderStatus };
  category: { name: string };
  destination: { name: string };
}

type OtpPurpose = "sign_in" | "sign_up" | "verify_phone" | "verify_email" | "reset_password";

/** Stores the in-memory access token from any sign-in style response. */
async function withSession(promise: Promise<TokenResponse>): Promise<TokenResponse> {
  const res = await promise;
  setAccessToken(res.accessToken);
  return res;
}

export const endpoints = {
  /** Phase 4 endpoint; until it ships, inventory sections show their designed empty state. */
  searchServices: (query: {
    destination?: string;
    /** Comma-separated category keys. */
    categories?: string;
    from?: string;
    to?: string;
    guests?: number;
    minPricePaise?: number;
    maxPricePaise?: number;
    minRating?: number;
    sort?: string;
    page?: number;
  }) => api.get<Paginated<ServiceSummary>>("/search/services", { query }),

  requestOtp: (body: { channel: "sms" | "email"; destination: string; purpose: OtpPurpose }) =>
    api.post<{ expiresInSeconds: number }>("/auth/otp/request", body),

  /** Passwordless phone sign-in (creates a traveller account on first use). */
  signInWithPhoneOtp: (body: { phone: string; code: string; fullName?: string }) =>
    withSession(api.post<TokenResponse & { isNewUser: boolean }>("/auth/otp/sign-in", body)),

  /** Creates an account; the phone is proven by a sign_up OTP in the same request. */
  signUp: (body: { fullName: string; phone: string; email?: string; password?: string; otpCode: string; termsVersion?: string }) =>
    withSession(api.post<TokenResponse>("/auth/sign-up", body)),

  signInWithPassword: (body: { email: string; password: string }) => withSession(api.post<TokenResponse>("/auth/sign-in", body)),

  signOut: async () => {
    await api.post<void>("/auth/sign-out");
    setAccessToken(null);
  },

  me: () => api.get<Me>("/auth/me"),

  createProviderApplication: (business: ProviderBusinessInput) =>
    api.post<{ data: { id: string; slug: string; status: ProviderStatus } }>("/provider-onboarding/applications", business),

  setProviderScope: (providerId: string, scope: ProviderCategoriesInput) =>
    api.put<{ data: ProviderApplication }>(`/provider-onboarding/applications/${providerId}/scope`, scope),

  getProviderApplication: (providerId: string) => api.get<{ data: ProviderApplication }>(`/provider-onboarding/applications/${providerId}`),

  adminOverview: () => api.get<{ data: AdminOverview }>("/admin/overview"),

  adminUsers: (query: AdminUsersQuery) => api.get<Paginated<AdminUser>>("/admin/users", { query: { ...query } }),

  /** Defaults to the review queue (submitted + under review). */
  adminApplications: (query: { status?: ProviderStatus | "all"; page?: number } = {}) =>
    api.get<Paginated<AdminApplication & { createdAt: string }>>("/admin/provider-applications", { query }),

  adminApplication: (providerId: string) => api.get<{ data: AdminProviderDetail }>(`/admin/provider-applications/${providerId}`),

  adminDecide: (providerId: string, body: { decision: ProviderDecision; message?: string; internalNote?: string }) =>
    api.post<{ data: { id: string; status: ProviderStatus } }>(`/admin/provider-applications/${providerId}/decision`, body),

  adminDestinations: () => api.get<{ data: AdminDestination[] }>("/admin/destinations"),

  adminUpdateDestination: (slug: string, body: { status?: AdminDestination["status"]; isFeatured?: boolean; reason?: string }) =>
    api.patch<{ data: { slug: string; status: AdminDestination["status"]; isFeatured: boolean } }>(`/admin/destinations/${slug}`, body),

  adminListings: (query: { status?: string; q?: string; page?: number } = {}) => api.get<Paginated<AdminListing>>("/admin/listings", { query }),
};
