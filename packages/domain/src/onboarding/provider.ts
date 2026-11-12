import type { DestinationStatus, DocumentStatus, ListingStatus, ProviderStatus } from "../catalog.js";
import { DomainError, article } from "../errors.js";
import { addDays, type LocalDate } from "../time.js";

export type OnboardingActor = "provider" | "admin" | "system";

const PROVIDER_TRANSITIONS: Record<ProviderStatus, { to: ProviderStatus; actors: OnboardingActor[]; event: string }[]> = {
  draft: [{ to: "submitted", actors: ["provider"], event: "application_submitted" }],
  submitted: [{ to: "under_review", actors: ["admin", "system"], event: "review_started" }],
  under_review: [
    { to: "approved", actors: ["admin"], event: "application_approved" },
    { to: "rejected", actors: ["admin"], event: "application_rejected" },
    { to: "info_requested", actors: ["admin"], event: "info_requested" },
  ],
  info_requested: [{ to: "submitted", actors: ["provider"], event: "application_resubmitted" }],
  rejected: [{ to: "draft", actors: ["provider"], event: "application_reopened" }],
  approved: [
    { to: "suspended", actors: ["admin"], event: "provider_suspended" },
    { to: "expired", actors: ["system", "admin"], event: "required_document_expired" },
    { to: "under_review", actors: ["admin"], event: "re_verification_started" },
  ],
  suspended: [{ to: "approved", actors: ["admin"], event: "provider_reinstated" }],
  expired: [{ to: "submitted", actors: ["provider"], event: "documents_renewed" }],
};

export function assertProviderTransition(from: ProviderStatus, to: ProviderStatus, actor: OnboardingActor) {
  const rule = PROVIDER_TRANSITIONS[from].find((r) => r.to === to && r.actors.includes(actor));
  if (!rule) throw new DomainError("PROVIDER_INVALID_TRANSITION", `${article(actor)} ${actor} cannot move a provider from ${from} to ${to}`, { from, to, actor });
  return rule;
}

export function providerNextStatuses(from: ProviderStatus, actor: OnboardingActor): ProviderStatus[] {
  return PROVIDER_TRANSITIONS[from].filter((r) => r.actors.includes(actor)).map((r) => r.to);
}

/** A document requirement, configured per category (and optionally per state/district). */
export interface DocumentRequirement {
  documentTypeKey: string;
  label: string;
  categoryKeys: readonly string[];
  required: boolean;
  requiresExpiry: boolean;
  /** What the document is about: the business, or each boat/vehicle/property/person. */
  subject: "business" | "owner" | "boat" | "vehicle" | "property" | "person";
}

export interface SubmittedDocument {
  documentTypeKey: string;
  status: DocumentStatus;
  expiresOn: LocalDate | null;
}

export interface DocumentEvaluation {
  missing: DocumentRequirement[];
  rejected: DocumentRequirement[];
  expired: DocumentRequirement[];
  pendingReview: DocumentRequirement[];
  expiringSoon: { requirement: DocumentRequirement; expiresOn: LocalDate }[];
  /** Every required document has been uploaded (it may still await review). */
  readyToSubmit: boolean;
  /** Every required document is verified and unexpired. */
  fullyVerified: boolean;
}

/**
 * Evaluates business-level documents for the categories a provider operates.
 * Asset-level documents (each boat, vehicle) are evaluated per inventory item
 * with the same function, passing that asset's documents.
 */
export function evaluateDocuments(
  requirements: readonly DocumentRequirement[],
  documents: readonly SubmittedDocument[],
  categoryKeys: readonly string[],
  today: LocalDate,
  expiryWarningDays = 30,
): DocumentEvaluation {
  const relevant = requirements.filter((r) => r.required && r.categoryKeys.some((c) => categoryKeys.includes(c)));
  const unique = [...new Map(relevant.map((r) => [r.documentTypeKey, r])).values()];
  const result: DocumentEvaluation = {
    missing: [],
    rejected: [],
    expired: [],
    pendingReview: [],
    expiringSoon: [],
    readyToSubmit: false,
    fullyVerified: false,
  };
  const warnBefore = addDays(today, expiryWarningDays);
  for (const req of unique) {
    // The current document is the newest non-superseded one; callers pass only current documents.
    const doc = documents.find((d) => d.documentTypeKey === req.documentTypeKey && d.status !== "superseded");
    if (!doc) {
      result.missing.push(req);
      continue;
    }
    const isExpired = doc.status === "expired" || (req.requiresExpiry && doc.expiresOn !== null && doc.expiresOn < today);
    if (isExpired) result.expired.push(req);
    else if (doc.status === "rejected") result.rejected.push(req);
    else if (doc.status === "pending") result.pendingReview.push(req);
    if (!isExpired && req.requiresExpiry && doc.expiresOn && doc.expiresOn <= warnBefore) {
      result.expiringSoon.push({ requirement: req, expiresOn: doc.expiresOn });
    }
    if (req.requiresExpiry && !doc.expiresOn && !isExpired) {
      // An expiring document without an expiry date cannot be considered verified.
      result.rejected.push(req);
    }
  }
  result.readyToSubmit = result.missing.length === 0 && result.rejected.length === 0 && result.expired.length === 0;
  result.fullyVerified = result.readyToSubmit && result.pendingReview.length === 0;
  return result;
}

/**
 * The publish gate. A listing is bookable only if every condition holds;
 * the API evaluates this on publish AND on every availability/booking request,
 * so a later suspension or document expiry takes effect immediately.
 */
export interface PublishGateInput {
  providerStatus: ProviderStatus;
  providerDocumentsVerified: boolean;
  listingStatus: ListingStatus;
  /** Category approved for this provider (provider_categories.status = approved). */
  providerCategoryApproved: boolean;
  destinationStatus: DestinationStatus;
  categoryEnabledInDestination: boolean;
  /** Asset documents (boat/vehicle registration, insurance) for the inventory being sold. */
  assetDocumentsVerified: boolean;
}

export type PublishBlocker =
  | "provider_not_approved"
  | "provider_documents_incomplete"
  | "listing_not_approved"
  | "category_not_approved"
  | "destination_not_active"
  | "category_not_enabled_in_destination"
  | "asset_documents_incomplete";

export function publishBlockers(i: PublishGateInput): PublishBlocker[] {
  const b: PublishBlocker[] = [];
  if (i.providerStatus !== "approved") b.push("provider_not_approved");
  if (!i.providerDocumentsVerified) b.push("provider_documents_incomplete");
  if (i.listingStatus !== "approved" && i.listingStatus !== "published") b.push("listing_not_approved");
  if (!i.providerCategoryApproved) b.push("category_not_approved");
  if (i.destinationStatus !== "active") b.push("destination_not_active");
  if (!i.categoryEnabledInDestination) b.push("category_not_enabled_in_destination");
  if (!i.assetDocumentsVerified) b.push("asset_documents_incomplete");
  return b;
}

export function isBookable(i: PublishGateInput & { listingStatus: ListingStatus }): boolean {
  return i.listingStatus === "published" && publishBlockers(i).length === 0;
}
