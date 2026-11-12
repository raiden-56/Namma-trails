/**
 * Canonical vocabulary shared by the API, the web app and the database enums.
 * Category *records* (labels, icons, commission, document requirements) live in
 * the database and are admin-managed; these keys are the stable identifiers
 * that business logic is allowed to branch on.
 */

/** How a category's inventory is reserved. Each maps to one availability strategy. */
export const BOOKING_MODELS = [
  "slot_capacity", //   seats/participants in a timed departure or session (boats, adventure, experiences)
  "nightly_inventory", // units per night between check-in and check-out (rooms, cottages)
  "time_range_rental", // units occupied for a pickup→return window (scooty, bike, self-drive car)
  "assigned_trip", //   a vehicle/driver assigned to a trip at a time (taxi, auto, outstation cab)
  "assigned_person", // a person booked for a half/full day (guides)
  "package", //         fixed-departure or on-request multi-day package
] as const;
export type BookingModel = (typeof BOOKING_MODELS)[number];

export const SERVICE_CATEGORY_KEYS = [
  "boating",
  "water_sports",
  "stay",
  "two_wheeler_rental",
  "car_rental",
  "taxi",
  "auto",
  "guide",
  "adventure",
  "experience",
  "sightseeing",
  "package",
] as const;
export type ServiceCategoryKey = (typeof SERVICE_CATEGORY_KEYS)[number];

/** Default booking model per category; categories are seeded with these and admins may not change the model after services exist. */
export const DEFAULT_BOOKING_MODEL: Record<ServiceCategoryKey, BookingModel> = {
  boating: "slot_capacity",
  water_sports: "slot_capacity",
  stay: "nightly_inventory",
  two_wheeler_rental: "time_range_rental",
  car_rental: "time_range_rental",
  taxi: "assigned_trip",
  auto: "assigned_trip",
  guide: "assigned_person",
  adventure: "slot_capacity",
  experience: "slot_capacity",
  sightseeing: "slot_capacity",
  package: "package",
};

/** Kinds of provider businesses (what the provider says they are, independent of listed services). */
export const PROVIDER_BUSINESS_TYPES = [
  "boat_operator",
  "hotel_resort",
  "homestay",
  "two_wheeler_rental",
  "car_rental",
  "taxi_operator",
  "auto_operator",
  "tour_guide",
  "adventure_operator",
  "tour_package_operator",
  "other",
] as const;
export type ProviderBusinessType = (typeof PROVIDER_BUSINESS_TYPES)[number];

export const DESTINATION_STATUSES = ["draft", "onboarding", "active", "temporarily_unavailable"] as const;
export type DestinationStatus = (typeof DESTINATION_STATUSES)[number];

export const PROVIDER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "info_requested",
  "approved",
  "rejected",
  "suspended",
  "expired",
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "approved", //  approved by admin but provider has paused it, or provider not yet bookable
  "published", // visible and bookable
  "paused",
  "rejected",
  "archived",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const DOCUMENT_STATUSES = ["pending", "verified", "rejected", "expired", "superseded"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const PRICING_MODELS = [
  "per_person", //          price × participants (boats shared rides, experiences)
  "per_unit", //            price × units (private boat charter, slot booked whole)
  "per_unit_per_night", //  rooms
  "per_unit_per_hour", //   short rentals
  "per_unit_per_day", //    day rentals (24h blocks)
  "distance_based", //      base fare + per-km (taxi)
  "flat", //                fixed price per booking (guide half-day, package)
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const TIME_ZONE = "Asia/Kolkata" as const;
export const CURRENCY = "INR" as const;
