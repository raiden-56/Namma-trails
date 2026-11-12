import type { ProviderBusinessType, ServiceCategoryKey } from "@/lib/catalog";

export const businessTypeOptions: Array<{ value: ProviderBusinessType; label: string }> = [
  { value: "boat_operator", label: "Boat operator" },
  { value: "hotel_resort", label: "Hotel or resort" },
  { value: "homestay", label: "Homestay or cottage" },
  { value: "two_wheeler_rental", label: "Scooty / bike rental" },
  { value: "car_rental", label: "Car rental" },
  { value: "taxi_operator", label: "Taxi operator" },
  { value: "auto_operator", label: "Auto operator" },
  { value: "tour_guide", label: "Tour guide" },
  { value: "adventure_operator", label: "Adventure activity operator" },
  { value: "tour_package_operator", label: "Tour package operator" },
  { value: "other", label: "Other tourism service" },
];

export const providerCategoryOptions: Array<{ value: ServiceCategoryKey; label: string; description: string }> = [
  { value: "boating", label: "Boat rides", description: "Shared or private rides, ferries, island trips" },
  { value: "water_sports", label: "Water sports", description: "Jet ski, banana boat, kayaking, snorkelling" },
  { value: "stay", label: "Stays", description: "Hotel, resort, homestay or cottage rooms" },
  { value: "two_wheeler_rental", label: "Scooty & bike rental", description: "Self-ride two-wheelers" },
  { value: "car_rental", label: "Car rental", description: "Self-drive cars" },
  { value: "taxi", label: "Taxi & cab", description: "Local, airport and outstation trips with a driver" },
  { value: "auto", label: "Auto rickshaw", description: "Short local trips" },
  { value: "guide", label: "Tour guide", description: "Half-day and full-day guiding" },
  { value: "adventure", label: "Adventure activities", description: "Treks, diving, camping, climbing" },
  { value: "experience", label: "Local experiences", description: "Food, craft, culture and nature sessions" },
  { value: "sightseeing", label: "Sightseeing tours", description: "Scheduled day tours" },
  { value: "package", label: "Tour packages", description: "Multi-day trips combining several services" },
];

/**
 * Display defaults for the onboarding checklist. The authoritative, jurisdiction-aware
 * requirement set is served by the API (category document requirements are admin-configurable);
 * this list is shown before an account exists so partners know what to prepare.
 */
export const documentChecklist: Record<ServiceCategoryKey, string[]> = {
  boating: ["Business identity proof", "Boat registration", "Operator permit or licence (where applicable)", "Safety equipment / fitness certificate (where required)", "Insurance (where applicable)", "Photos of each boat"],
  water_sports: ["Business identity proof", "Activity operator permit (where applicable)", "Safety and equipment certificates", "Insurance (where applicable)", "Instructor credentials"],
  stay: ["Business identity proof", "Accommodation registration or licence (where applicable)", "Property address proof", "Property photos"],
  two_wheeler_rental: ["Business identity proof", "Rental permit (where applicable)", "Vehicle registration certificates", "Valid vehicle insurance"],
  car_rental: ["Business identity proof", "Rental permit (where applicable)", "Vehicle registration certificates", "Valid vehicle insurance", "Fitness and permit documents (where applicable)"],
  taxi: ["Driving licence", "Vehicle registration certificate", "Valid insurance", "Commercial / tourist permit (where applicable)", "Profile photograph"],
  auto: ["Driving licence", "Vehicle registration certificate", "Valid insurance", "Permit (where applicable)", "Profile photograph"],
  guide: ["Identity proof", "Guide licence or credentials (where applicable)", "Languages spoken", "Profile photograph"],
  adventure: ["Business identity proof", "Activity permits (where applicable)", "Safety certifications", "Insurance (where applicable)", "Instructor credentials"],
  experience: ["Identity or business proof", "Venue details", "Photos"],
  sightseeing: ["Business identity proof", "Vehicle documents (if transport is included)", "Guide credentials (where applicable)"],
  package: ["Business identity proof", "Tour operator registration (where applicable)", "Component partner details"],
};

export const OPERATING_STATE = "Karnataka";
export const TERMS_VERSION = "provider-terms-draft-2026-11";
