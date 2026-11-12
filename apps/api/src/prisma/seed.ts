/**
 * Reference-data seed. Idempotent (safe to re-run).
 *
 * Seeds ONLY platform configuration: permissions, roles, categories, document
 * types/requirements, cancellation-policy presets, and the four Phase 1
 * destinations in "onboarding" status. It creates NO providers, listings,
 * prices, ratings or reviews — marketplace inventory must come from real,
 * verified providers. Destination copy is a starting draft for the CMS and
 * should be reviewed by the content team before launch.
 *
 * Document requirements are a starting configuration, NOT legal advice: the
 * verification team must confirm the applicable licences per category and
 * jurisdiction before launch.
 */
import "reflect-metadata";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  DEFAULT_BOOKING_MODEL,
  DEFAULT_PLATFORM_ROLE_PERMISSIONS,
  ORG_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  SELF_PERMISSIONS,
  type PricingModel,
  type ServiceCategoryKey,
} from "@kt/domain";
import { PrismaClient, type DocumentSubject } from "../generated/prisma/client.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required to seed");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const ROLE_NAMES: Record<string, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  verification_admin: "Verification Admin",
  finance_admin: "Finance Admin",
  support_admin: "Customer Support Admin",
  traveler: "Traveller",
};

const CATEGORIES: { key: ServiceCategoryKey; name: string; slug: string; icon: string; pricing: PricingModel; description: string }[] = [
  { key: "stay", name: "Stays", slug: "stays", icon: "bed", pricing: "per_unit_per_night", description: "Hotels, resorts, homestays and cottages" },
  { key: "boating", name: "Boating", slug: "boating", icon: "sailboat", pricing: "per_person", description: "Shared and private boat rides" },
  { key: "water_sports", name: "Water sports", slug: "water-sports", icon: "waves", pricing: "per_person", description: "Beach and water activities" },
  { key: "two_wheeler_rental", name: "Scooty & bike rentals", slug: "bike-rentals", icon: "bike", pricing: "per_unit_per_day", description: "Scooters and motorcycles by the day or hour" },
  { key: "car_rental", name: "Self-drive cars", slug: "car-rentals", icon: "car", pricing: "per_unit_per_day", description: "Self-drive car rentals" },
  { key: "taxi", name: "Taxis & cabs", slug: "cabs", icon: "car-taxi-front", pricing: "distance_based", description: "Local, airport and outstation cabs" },
  { key: "auto", name: "Autos", slug: "autos", icon: "truck", pricing: "distance_based", description: "Auto-rickshaw rides" },
  { key: "guide", name: "Local guides", slug: "guides", icon: "map", pricing: "flat", description: "Verified local guides by the half or full day" },
  { key: "adventure", name: "Adventure", slug: "adventure", icon: "mountain", pricing: "per_person", description: "Treks, kayaking and outdoor activities" },
  { key: "experience", name: "Local experiences", slug: "experiences", icon: "sparkles", pricing: "per_person", description: "Food, culture and craft experiences" },
  { key: "sightseeing", name: "Sightseeing", slug: "sightseeing", icon: "binoculars", pricing: "per_person", description: "Guided sightseeing tours" },
  { key: "package", name: "Packages", slug: "packages", icon: "package", pricing: "flat", description: "Curated multi-day packages" },
];

const DOCUMENT_TYPES: { key: string; label: string; subject: DocumentSubject; requiresNumber: boolean; requiresExpiry: boolean; categories: ServiceCategoryKey[] }[] = [
  { key: "owner_identity", label: "Owner identity proof", subject: "owner", requiresNumber: true, requiresExpiry: false, categories: ["stay", "boating", "water_sports", "two_wheeler_rental", "car_rental", "taxi", "auto", "guide", "adventure", "experience", "sightseeing", "package"] },
  { key: "business_registration", label: "Business registration / trade licence (where applicable)", subject: "business", requiresNumber: true, requiresExpiry: false, categories: ["stay", "boating", "water_sports", "two_wheeler_rental", "car_rental", "adventure", "package"] },
  { key: "address_proof", label: "Business address proof", subject: "business", requiresNumber: false, requiresExpiry: false, categories: ["stay", "boating", "two_wheeler_rental", "car_rental"] },
  { key: "accommodation_licence", label: "Accommodation registration or licence (as applicable)", subject: "property", requiresNumber: true, requiresExpiry: true, categories: ["stay"] },
  { key: "boat_registration", label: "Boat registration certificate", subject: "boat", requiresNumber: true, requiresExpiry: true, categories: ["boating", "water_sports"] },
  { key: "boat_operator_permit", label: "Boat operation permit / licence (as applicable)", subject: "business", requiresNumber: true, requiresExpiry: true, categories: ["boating", "water_sports"] },
  { key: "safety_certificate", label: "Safety equipment / fitness certificate (where required)", subject: "boat", requiresNumber: false, requiresExpiry: true, categories: ["boating", "water_sports"] },
  { key: "liability_insurance", label: "Insurance", subject: "business", requiresNumber: true, requiresExpiry: true, categories: ["boating", "water_sports", "adventure"] },
  { key: "vehicle_rc", label: "Vehicle registration certificate (RC)", subject: "vehicle", requiresNumber: true, requiresExpiry: true, categories: ["two_wheeler_rental", "car_rental", "taxi", "auto"] },
  { key: "vehicle_insurance", label: "Vehicle insurance", subject: "vehicle", requiresNumber: true, requiresExpiry: true, categories: ["two_wheeler_rental", "car_rental", "taxi", "auto"] },
  { key: "vehicle_permit", label: "Vehicle permit / fitness (as applicable)", subject: "vehicle", requiresNumber: true, requiresExpiry: true, categories: ["taxi", "auto"] },
  { key: "rental_permission", label: "Rental business permission (as applicable)", subject: "business", requiresNumber: true, requiresExpiry: true, categories: ["two_wheeler_rental", "car_rental"] },
  { key: "driving_licence", label: "Driver's driving licence", subject: "person", requiresNumber: true, requiresExpiry: true, categories: ["taxi", "auto"] },
  { key: "guide_credentials", label: "Guide credentials (where applicable)", subject: "person", requiresNumber: false, requiresExpiry: false, categories: ["guide"] },
  { key: "profile_photo", label: "Profile photograph", subject: "person", requiresNumber: false, requiresExpiry: false, categories: ["guide", "taxi", "auto"] },
];

/**
 * Starting destination drafts. Copy is intentionally conservative (no figures
 * that need verification). Coordinates are approximate town centres for map
 * framing only and must be confirmed by the content team.
 */
const DESTINATIONS = [
  { slug: "gokarna", name: "Gokarna", district: "Uttara Kannada", lat: 14.5479, lng: 74.3188, tagline: "Temple town, quiet coves and coastal walks", sortOrder: 1 },
  { slug: "murudeshwar", name: "Murudeshwar", district: "Uttara Kannada", lat: 14.0943, lng: 74.4846, tagline: "A seaside temple town on the Arabian Sea", sortOrder: 2 },
  { slug: "karwar", name: "Karwar", district: "Uttara Kannada", lat: 14.8136, lng: 74.1297, tagline: "Where the Kali river meets the sea", sortOrder: 3 },
  { slug: "udupi", name: "Udupi", district: "Udupi", lat: 13.3409, lng: 74.7421, tagline: "Temple heritage, beaches and coastal cuisine", sortOrder: 4 },
];

const CANCELLATION_PRESETS = [
  { name: "Flexible", summary: "Full refund up to 24 hours before start.", tiers: [{ minHoursBeforeStart: 24, refundBps: 10000 }, { minHoursBeforeStart: 0, refundBps: 0 }] },
  { name: "Moderate", summary: "Full refund up to 72 hours before; 50% up to 24 hours before.", tiers: [{ minHoursBeforeStart: 72, refundBps: 10000 }, { minHoursBeforeStart: 24, refundBps: 5000 }, { minHoursBeforeStart: 0, refundBps: 0 }] },
  { name: "Strict", summary: "50% refund up to 7 days before start; no refund after.", tiers: [{ minHoursBeforeStart: 168, refundBps: 5000 }, { minHoursBeforeStart: 0, refundBps: 0 }] },
];

async function main() {
  // Permissions
  const allPerms = [
    ...PLATFORM_PERMISSIONS.map((key) => ({ key, scope: "platform" as const })),
    ...ORG_PERMISSIONS.map((key) => ({ key, scope: "org" as const })),
    ...SELF_PERMISSIONS.map((key) => ({ key, scope: "self" as const })),
  ];
  for (const p of allPerms) await prisma.permission.upsert({ where: { key: p.key }, create: p, update: { scope: p.scope } });
  const permIds = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  // Platform roles. Existing role permissions are left untouched so admin edits survive re-seeding.
  for (const [key, perms] of Object.entries(DEFAULT_PLATFORM_ROLE_PERMISSIONS)) {
    const existing = await prisma.role.findUnique({ where: { key } });
    if (existing) {
      // Keep display names current; permissions stay as admins configured them.
      if (existing.isSystem && ROLE_NAMES[key] && existing.name !== ROLE_NAMES[key]) {
        await prisma.role.update({ where: { id: existing.id }, data: { name: ROLE_NAMES[key] } });
      }
      continue;
    }
    await prisma.role.create({
      data: {
        key,
        name: ROLE_NAMES[key] ?? key,
        scope: "platform",
        isSystem: true,
        permissions: { create: perms.map((p) => ({ permissionId: permIds.get(p)! })) },
      },
    });
  }

  // Categories
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { key: c.key },
      create: { key: c.key, name: c.name, slug: c.slug, icon: c.icon, description: c.description, bookingModel: DEFAULT_BOOKING_MODEL[c.key], defaultPricingModel: c.pricing, sortOrder: i },
      update: { name: c.name, icon: c.icon, description: c.description },
    });
  }
  const categoryIds = new Map((await prisma.category.findMany()).map((c) => [c.key, c.id]));

  // Document types and state-wide requirements (district-specific ones are added by admins).
  for (const d of DOCUMENT_TYPES) {
    const type = await prisma.documentType.upsert({
      where: { key: d.key },
      create: { key: d.key, label: d.label, subject: d.subject, requiresNumber: d.requiresNumber, requiresExpiry: d.requiresExpiry },
      update: { label: d.label },
    });
    for (const cat of d.categories) {
      const categoryId = categoryIds.get(cat)!;
      const exists = await prisma.documentRequirement.findFirst({ where: { categoryId, documentTypeId: type.id, state: null, district: null } });
      if (!exists) await prisma.documentRequirement.create({ data: { categoryId, documentTypeId: type.id, required: true } });
    }
  }

  for (const p of CANCELLATION_PRESETS) {
    const exists = await prisma.cancellationPolicy.findFirst({ where: { providerId: null, name: p.name } });
    if (!exists) await prisma.cancellationPolicy.create({ data: { name: p.name, summary: p.summary, tiers: p.tiers, platformFeeRefundable: false } });
  }

  // Destinations start in "onboarding": visible as coming soon, nothing bookable until admins activate them.
  for (const d of DESTINATIONS) {
    const dest = await prisma.destination.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, name: d.name, district: d.district, tagline: d.tagline, status: "onboarding", launchPhase: 1, sortOrder: d.sortOrder, isFeatured: true },
      update: {},
    });
    await prisma.$executeRaw`UPDATE destinations SET location = ST_SetSRID(ST_MakePoint(${d.lng}, ${d.lat}), 4326)::geography WHERE id = ${dest.id}::uuid AND location IS NULL`;
    for (const key of ["stay", "boating", "water_sports", "two_wheeler_rental", "taxi", "auto", "guide", "adventure", "experience"] as const) {
      await prisma.destinationCategory.upsert({
        where: { destinationId_categoryId: { destinationId: dest.id, categoryId: categoryIds.get(key)! } },
        create: { destinationId: dest.id, categoryId: categoryIds.get(key)!, isEnabled: true },
        update: {},
      });
    }
  }

  await prisma.featureFlag.upsert({ where: { key: "multi_service_checkout" }, create: { key: "multi_service_checkout", enabled: false, description: "Enable consolidated checkout for multi-service trips (Phase 5)" }, update: {} });
  await prisma.featureFlag.upsert({ where: { key: "ai_itinerary_assistant" }, create: { key: "ai_itinerary_assistant", enabled: false, description: "Optional AI itinerary suggestions (never shows invented prices or availability)" }, update: {} });

  console.log("Reference data seeded: %d permissions, %d categories, %d document types, %d destinations", allPerms.length, CATEGORIES.length, DOCUMENT_TYPES.length, DESTINATIONS.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
