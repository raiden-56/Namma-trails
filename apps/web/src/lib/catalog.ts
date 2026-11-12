/**
 * UI-side view of the marketplace vocabulary. The source of truth is
 * @kt/domain (packages/domain/src); this module only re-exports it so UI
 * code has one import path.
 */
export type {
  BookingStatus,
  DestinationStatus,
  DocumentStatus,
  ListingStatus,
  ProviderBusinessType,
  ProviderStatus,
  ServiceCategoryKey,
} from "@kt/domain";
