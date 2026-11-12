/**
 * DEMO DATA for local testing of every feature. Development only.
 *
 * All businesses, people, phone numbers and reviews are fictional. Users,
 * providers and services are flagged is_demo; bookings, payments and reviews
 * hang off them. Bookings are created through the real BookingEngine on a
 * simulated clock, so their prices, holds, settlements and refunds follow the
 * same rules as live bookings. Tax and commission values are demo
 * configuration, not tax advice.
 *
 * Run:    pnpm db:seed:demo        (after pnpm db:seed)
 * Remove: pnpm db:reset:demo       (resets the local database and reseeds)
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { addDays, istDateOf, istInstant } from "@kt/domain";
import { type Prisma, PrismaClient } from "../generated/prisma/client.js";
import { hashPassword } from "../modules/auth/password.js";
import { BookingEngine, type BookingRequest } from "../modules/bookings/engine.js";
import { MockGateway, reference } from "../modules/bookings/support.js";

if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") throw new Error("Demo data must never be loaded outside development");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const engine = new BookingEngine(prisma, new MockGateway());

export const DEMO_PASSWORD = "NammaDemo2026";
const REAL_NOW = new Date();
const TODAY = istDateOf(REAL_NOW);
const day = (offset: number) => addDays(TODAY, offset);
const rupees = (r: number) => Math.round(r * 100);

/* Deterministic randomness so every reset produces the same story. */
let seedState = 20261112;
const rand = () => {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/* ───────────────────────── people ───────────────────────── */

const ADMINS = [
  { email: "superadmin@demo.example.com", phone: "9100000001", name: "Kavya Hegde", role: "super_admin" },
  { email: "ops@demo.example.com", phone: "9100000002", name: "Rohan Kamath", role: "operations_admin" },
  { email: "verify@demo.example.com", phone: "9100000003", name: "Shreya Nayak", role: "verification_admin" },
  { email: "finance@demo.example.com", phone: "9100000004", name: "Vikram Rao", role: "finance_admin" },
  { email: "support@demo.example.com", phone: "9100000005", name: "Neha Prabhu", role: "support_admin" },
] as const;

const TRAVELLERS = [
  { email: "asha@demo.example.com", phone: "9100000101", name: "Asha Rao" },
  { email: "rahul@demo.example.com", phone: "9100000102", name: "Rahul Menon" },
  { email: "priya@demo.example.com", phone: "9100000103", name: "Priya Shetty" },
  { email: "arjun@demo.example.com", phone: "9100000104", name: "Arjun Nair" },
  { email: "meera@demo.example.com", phone: "9100000105", name: "Meera Iyer" },
  { email: "sameer@demo.example.com", phone: "9100000106", name: "Sameer Khan" },
] as const;

type ServiceSpec = {
  key: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  highlights: string[];
  inclusions?: string[];
  exclusions?: string[];
  photos: string[];
  confirmation?: "instant" | "request";
  policy: "Flexible" | "Moderate" | "Strict";
  status?: "published" | "pending_review";
  durationMinutes?: number;
  maxParticipants?: number;
  minAge?: number;
  languages?: string[];
  safetyInfo?: string;
  weatherDependent?: boolean;
  requiresLicence?: boolean;
  providerResponseMins?: number;
  attributes?: Record<string, unknown>;
  locations?: { kind: "primary" | "boarding_point" | "pickup_point" | "meeting_point" | "property"; name: string; addressLine: string; instructions?: string; lat: number; lng: number }[];
  /** Inventory: rooms, boats, scooters, cabs or guides, each with its own price where relevant. */
  items: { name: string; units?: number; capacity: number; turnaroundMins?: number; tags?: string[]; attributes?: Record<string, unknown>; price?: Partial<Plan> }[];
  plan: Plan;
  /** Departure schedule for slot-based services. */
  schedule?: { times: string[]; days?: number[]; durationMinutes: number };
  seasonal?: { label: string; daysOfWeek: number[]; adjustmentBps: number };
};

type Plan = {
  model: "per_person" | "per_unit" | "per_unit_per_night" | "per_unit_per_day" | "distance_based" | "flat";
  base: number;
  child?: number;
  extraAdult?: number;
  includedOccupancy?: number;
  perKm?: number;
  minimumFare?: number;
  deposit?: number;
  minimumUnits?: number;
};

type PartnerSpec = {
  key: string;
  owner: { email: string; phone: string; name: string };
  staff?: { email: string; phone: string; name: string; role: "front_desk" | "operator" | "manager" }[];
  business: { displayName: string; legalName: string; type: "homestay" | "hotel_resort" | "boat_operator" | "two_wheeler_rental" | "taxi_operator" | "adventure_operator" | "tour_guide" | "car_rental"; description: string; city: string; district: string; pincode: string; lat: number; lng: number };
  destination: string;
  categories: string[];
  status: "approved" | "submitted" | "info_requested";
  services: ServiceSpec[];
};

const PARTNERS: PartnerSpec[] = [
  {
    key: "seabreeze",
    owner: { email: "ravi@demo.example.com", phone: "9100000201", name: "Ravi Gaonkar" },
    staff: [{ email: "anita@demo.example.com", phone: "9100000212", name: "Anita Gowda", role: "front_desk" }],
    business: { displayName: "Sea Breeze Homestay", legalName: "Sea Breeze Homestay (Demo)", type: "homestay", description: "A family-run homestay a short walk from the beach, with home-cooked coastal breakfasts and a shaded veranda.", city: "Gokarna", district: "Uttara Kannada", pincode: "581326", lat: 14.535, lng: 74.317 },
    destination: "gokarna",
    categories: ["stay"],
    status: "approved",
    services: [
      {
        key: "seabreeze-rooms",
        title: "Sea Breeze Homestay — garden and sea-view rooms",
        summary: "Quiet rooms near the beach trail, breakfast included.",
        description: "Simple, spotless rooms around a garden courtyard. Breakfast is cooked by the family each morning. The beach trail starts five minutes from the gate.",
        category: "stay",
        highlights: ["Breakfast included", "5 minutes to the beach trail", "Family-run", "Hot water and Wi-Fi"],
        inclusions: ["Breakfast", "Wi-Fi", "Drinking water"],
        exclusions: ["Lunch and dinner", "Airport transfers"],
        photos: ["homestay-veranda", "kudle-beach-sunset", "gokarna-om-beach"],
        policy: "Moderate",
        attributes: { checkInTime: "13:00", checkOutTime: "11:00", mealPlan: "Breakfast included" },
        locations: [{ kind: "property", name: "Sea Breeze Homestay", addressLine: "Beach Road, Gokarna (demo address)", lat: 14.535, lng: 74.317 }],
        items: [
          { name: "Garden room (2 guests)", units: 3, capacity: 2, price: { base: 2800, extraAdult: 600, includedOccupancy: 2 } },
          { name: "Sea-view room (3 guests)", units: 2, capacity: 3, price: { base: 3900, extraAdult: 700, includedOccupancy: 2 } },
        ],
        plan: { model: "per_unit_per_night", base: 2800, extraAdult: 600, includedOccupancy: 2 },
        seasonal: { label: "Weekend rate", daysOfWeek: [5, 6], adjustmentBps: 1500 },
      },
    ],
  },
  {
    key: "omcoast",
    owner: { email: "nagesh@demo.example.com", phone: "9100000202", name: "Nagesh Harikantra" },
    staff: [{ email: "manju@demo.example.com", phone: "9100000213", name: "Manju Tandel", role: "operator" }],
    business: { displayName: "Om Coast Boat Rides", legalName: "Om Coast Boat Rides (Demo)", type: "boat_operator", description: "Licensed local boatmen running shared sunset rides and private coastal charters with life jackets for every rider.", city: "Gokarna", district: "Uttara Kannada", pincode: "581326", lat: 14.519, lng: 74.32 },
    destination: "gokarna",
    categories: ["boating"],
    status: "approved",
    services: [
      {
        key: "omcoast-sunset",
        title: "Sunset boat ride along the Gokarna coves",
        summary: "A one-hour shared ride past the beaches at golden hour.",
        description: "Board from the beach jetty and cruise past the coves while the sun sets over the Arabian Sea. Life jackets are provided and worn throughout.",
        category: "boating",
        highlights: ["Life jackets for everyone", "Licensed boatman", "1 hour", "Best at sunset"],
        inclusions: ["Life jacket", "Boatman"],
        photos: ["boat-ride-sunset", "gokarna-om-beach"],
        policy: "Flexible",
        durationMinutes: 60,
        maxParticipants: 10,
        minAge: 4,
        weatherDependent: true,
        safetyInfo: "Rides run only in safe sea conditions; the boatman may cancel for weather, with a full refund. Life jackets must be worn at all times.",
        locations: [{ kind: "boarding_point", name: "Beach jetty", addressLine: "Main beach, Gokarna (demo)", instructions: "Meet at the blue boat shed 15 minutes before departure.", lat: 14.519, lng: 74.32 }],
        items: [{ name: "Boat Sagar (10 seats)", capacity: 10 }],
        plan: { model: "per_person", base: 600, child: 350 },
        schedule: { times: ["07:30", "16:30", "17:30"], durationMinutes: 60 },
      },
      {
        key: "omcoast-charter",
        title: "Private boat charter — Gokarna coves",
        summary: "Your own boat for two hours, up to 8 people.",
        description: "A private boat for your group to explore the coves at your pace. Pending moderation in the demo so you can try the admin approval flow.",
        category: "boating",
        highlights: ["Private boat", "Up to 8 people", "2 hours"],
        photos: ["gokarna-om-beach"],
        policy: "Moderate",
        status: "pending_review",
        durationMinutes: 120,
        maxParticipants: 8,
        weatherDependent: true,
        items: [{ name: "Boat Ganga (8 seats)", capacity: 8 }],
        plan: { model: "per_unit", base: 4500 },
        schedule: { times: ["10:00", "14:00"], durationMinutes: 120 },
      },
    ],
  },
  {
    key: "scooty",
    owner: { email: "vinay@demo.example.com", phone: "9100000203", name: "Vinay Naik" },
    business: { displayName: "Gokarna Scooty Point", legalName: "Gokarna Scooty Point (Demo)", type: "two_wheeler_rental", description: "Well-serviced scooters with helmets, for exploring Gokarna's beaches at your own pace.", city: "Gokarna", district: "Uttara Kannada", pincode: "581326", lat: 14.547, lng: 74.318 },
    destination: "gokarna",
    categories: ["two_wheeler_rental"],
    status: "approved",
    services: [
      {
        key: "scooty-rental",
        title: "Scooty rental in Gokarna town",
        summary: "Daily scooter hire with two helmets.",
        description: "Pick up from the shop near the bus stand. Bring a valid two-wheeler licence; a refundable deposit is collected and returned on drop-off.",
        category: "two_wheeler_rental",
        highlights: ["Two helmets included", "Refundable deposit", "Serviced weekly"],
        inclusions: ["2 helmets", "Basic insurance"],
        exclusions: ["Fuel"],
        photos: ["scooter", "nh66-kapu"],
        policy: "Flexible",
        requiresLicence: true,
        attributes: { fuelPolicy: "Return with the same fuel level" },
        locations: [{ kind: "pickup_point", name: "Scooty Point shop", addressLine: "Near the bus stand, Gokarna (demo)", lat: 14.547, lng: 74.318 }],
        items: [
          { name: "Honda Activa 110cc", units: 6, capacity: 2, turnaroundMins: 60, price: { base: 450, deposit: 2000 } },
          { name: "TVS Jupiter 110cc", units: 4, capacity: 2, turnaroundMins: 60, price: { base: 400, deposit: 2000 } },
        ],
        plan: { model: "per_unit_per_day", base: 400, deposit: 2000 },
      },
    ],
  },
  {
    key: "cabs",
    owner: { email: "imran@demo.example.com", phone: "9100000204", name: "Imran Sheikh" },
    business: { displayName: "Coastline Cabs", legalName: "Coastline Cabs (Demo)", type: "taxi_operator", description: "Air-conditioned cabs for local sightseeing, station and airport transfers.", city: "Gokarna", district: "Uttara Kannada", pincode: "581326", lat: 14.546, lng: 74.316 },
    destination: "gokarna",
    categories: ["taxi"],
    status: "approved",
    services: [
      {
        key: "cabs-local",
        title: "Cabs around Gokarna — station, beaches and town",
        summary: "Fixed routes with transparent per-km fares.",
        description: "Choose a route and pickup time. Fares are the operator's per-km rate on the operator's declared route distance (demo data).",
        category: "taxi",
        highlights: ["AC cabs", "Fixed routes", "Driver assigned on booking"],
        photos: ["nh66-kapu"],
        policy: "Flexible",
        attributes: {
          routes: [
            { id: "station-town", name: "Gokarna Road station → Gokarna town", km: 10, durationMinutes: 30 },
            { id: "town-om", name: "Gokarna town → Om Beach", km: 7, durationMinutes: 25 },
            { id: "town-murudeshwar", name: "Gokarna → Murudeshwar", km: 75, durationMinutes: 120 },
          ],
        },
        items: [
          { name: "Swift Dzire (4 seats)", capacity: 4 },
          { name: "Toyota Innova (6 seats)", capacity: 6 },
        ],
        plan: { model: "distance_based", base: 150, perKm: 18, minimumFare: 400 },
      },
    ],
  },
  {
    key: "netrani",
    owner: { email: "ganesh@demo.example.com", phone: "9100000205", name: "Ganesh Mogera" },
    business: { displayName: "Netrani Blue Boats", legalName: "Netrani Blue Boats (Demo)", type: "boat_operator", description: "Beach boat rides at Murudeshwar and weather-permitting snorkelling trips with trained instructors.", city: "Murudeshwar", district: "Uttara Kannada", pincode: "581350", lat: 14.094, lng: 74.483 },
    destination: "murudeshwar",
    categories: ["boating", "water_sports"],
    status: "approved",
    services: [
      {
        key: "netrani-beach-ride",
        title: "Murudeshwar beach boat ride",
        summary: "A 20-minute ride with views of the temple and statue from the sea.",
        description: "A short, shared ride from the main beach with views back to the temple tower and the Shiva statue.",
        category: "boating",
        highlights: ["Temple views from the sea", "20 minutes", "Life jackets provided"],
        photos: ["murudeshwar-shiva-statue"],
        policy: "Flexible",
        durationMinutes: 20,
        maxParticipants: 15,
        weatherDependent: true,
        safetyInfo: "Life jackets are mandatory. Rides stop in rough seas; affected bookings are fully refunded.",
        items: [{ name: "Boat Matsya (15 seats)", capacity: 15 }],
        plan: { model: "per_person", base: 300, child: 200 },
        schedule: { times: ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00"], durationMinutes: 20 },
      },
      {
        key: "netrani-snorkel",
        title: "Netrani Island snorkelling trip",
        summary: "Half-day trip with instructors — confirmed by the operator after checking sea conditions.",
        description: "A boat trip to Netrani Island with a snorkelling session guided by instructors. The operator confirms each booking after checking the sea forecast.",
        category: "water_sports",
        highlights: ["Instructor-led", "Equipment included", "Operator confirms after weather check"],
        inclusions: ["Snorkel gear", "Life jacket", "Instructor"],
        photos: ["karwar-beach", "boat-ride-sunset"],
        confirmation: "request",
        providerResponseMins: 2880,
        policy: "Moderate",
        durationMinutes: 300,
        maxParticipants: 12,
        minAge: 10,
        weatherDependent: true,
        safetyInfo: "Swimming ability is not required, but participants must follow instructor guidance. Trips run only in calm conditions.",
        items: [{ name: "Boat Netra (12 seats)", capacity: 12 }],
        plan: { model: "per_person", base: 3500 },
        schedule: { times: ["08:00"], durationMinutes: 300 },
      },
    ],
  },
  {
    key: "templeview",
    owner: { email: "lakshmi@demo.example.com", phone: "9100000206", name: "Lakshmi Bhat" },
    business: { displayName: "Temple View Residency", legalName: "Temple View Residency (Demo)", type: "hotel_resort", description: "A small hotel within walking distance of the temple, with family rooms.", city: "Murudeshwar", district: "Uttara Kannada", pincode: "581350", lat: 14.096, lng: 74.486 },
    destination: "murudeshwar",
    categories: ["stay"],
    status: "approved",
    services: [
      {
        key: "templeview-rooms",
        title: "Temple View Residency — doubles and family suites",
        summary: "Comfortable rooms a short walk from the temple and beach.",
        description: "Clean, air-conditioned rooms with a rooftop breakfast area. Family suites sleep four.",
        category: "stay",
        highlights: ["Walk to the temple", "AC rooms", "Family suites"],
        photos: ["murudeshwar-shiva-statue", "homestay-veranda"],
        policy: "Strict",
        attributes: { checkInTime: "12:00", checkOutTime: "11:00", mealPlan: "Room only" },
        items: [
          { name: "Standard double (2 guests)", units: 5, capacity: 2, price: { base: 2200, extraAdult: 500, includedOccupancy: 2 } },
          { name: "Family suite (4 guests)", units: 2, capacity: 4, price: { base: 4200, extraAdult: 600, includedOccupancy: 4 } },
        ],
        plan: { model: "per_unit_per_night", base: 2200, extraAdult: 500, includedOccupancy: 2 },
      },
    ],
  },
  {
    key: "kali",
    owner: { email: "joel@demo.example.com", phone: "9100000207", name: "Joel D'Souza" },
    business: { displayName: "Kali River Kayaking", legalName: "Kali River Kayaking (Demo)", type: "adventure_operator", description: "Guided kayaking on the Kali river with certified guides and safety boats.", city: "Karwar", district: "Uttara Kannada", pincode: "581301", lat: 14.84, lng: 74.14 },
    destination: "karwar",
    categories: ["adventure"],
    status: "approved",
    services: [
      {
        key: "kali-morning",
        title: "Morning kayaking on the Kali river",
        summary: "Two hours of guided paddling for beginners.",
        description: "A calm-water session with a short safety briefing. Suitable for first-timers aged 12 and above.",
        category: "adventure",
        highlights: ["Beginner friendly", "Certified guide", "Safety briefing"],
        inclusions: ["Kayak", "Paddle", "Life jacket", "Guide"],
        photos: ["kayaks-riverbank", "karwar-kali-river"],
        policy: "Moderate",
        durationMinutes: 120,
        maxParticipants: 8,
        minAge: 12,
        weatherDependent: true,
        items: [{ name: "Kayak fleet (8 seats)", capacity: 8 }],
        plan: { model: "per_person", base: 1200 },
        schedule: { times: ["07:00"], durationMinutes: 120 },
      },
      {
        key: "kali-sunset",
        title: "Sunset kayak on the Kali estuary",
        summary: "Paddle towards the river mouth as the sun goes down.",
        description: "An evening paddle where the Kali meets the sea, finishing at sunset.",
        category: "adventure",
        highlights: ["Sunset views", "Small groups", "90 minutes"],
        photos: ["karwar-kali-river", "kayaks-riverbank"],
        policy: "Moderate",
        durationMinutes: 90,
        maxParticipants: 6,
        minAge: 12,
        weatherDependent: true,
        items: [{ name: "Kayak fleet (6 seats)", capacity: 6 }],
        plan: { model: "per_person", base: 1500 },
        schedule: { times: ["17:00"], durationMinutes: 90 },
      },
    ],
  },
  {
    key: "heritage",
    owner: { email: "sudha@demo.example.com", phone: "9100000208", name: "Sudha Acharya" },
    business: { displayName: "Udupi Heritage Walks", legalName: "Udupi Heritage Walks (Demo)", type: "tour_guide", description: "Local guides for temple-town walks and evenings of Yakshagana, the region's traditional theatre.", city: "Udupi", district: "Udupi", pincode: "576101", lat: 13.341, lng: 74.751 },
    destination: "udupi",
    categories: ["guide", "experience"],
    status: "approved",
    services: [
      {
        key: "heritage-walk",
        title: "Udupi temple-town walk with a local guide",
        summary: "A half-day walk through the car street and old mathas — guide confirms your slot.",
        description: "Explore the temple precinct, the chariot street and old mathas with a guide who grew up here. Your guide confirms the booking before payment.",
        category: "guide",
        highlights: ["Half day (4 hours)", "Kannada, English, Hindi, Tulu", "Guide confirms first"],
        photos: ["udupi-krishna-matha", "gokarna-koti-teertha"],
        confirmation: "request",
        providerResponseMins: 2880,
        policy: "Flexible",
        durationMinutes: 240,
        maxParticipants: 10,
        languages: ["Kannada", "English", "Hindi", "Tulu"],
        locations: [{ kind: "meeting_point", name: "Car Street entrance", addressLine: "Car Street, Udupi (demo)", lat: 13.341, lng: 74.751 }],
        items: [
          { name: "Guide Sudha (Kannada, English, Hindi)", capacity: 10, tags: ["kn", "en", "hi"] },
          { name: "Guide Ramesh (Kannada, Tulu, English)", capacity: 10, tags: ["kn", "tcy", "en"] },
        ],
        plan: { model: "flat", base: 1500 },
      },
      {
        key: "heritage-yakshagana",
        title: "Yakshagana evening with an artist talk",
        summary: "Watch a performance and meet the artists backstage.",
        description: "An evening of Yakshagana, the dance-drama tradition of coastal Karnataka, with a short talk on costumes and make-up.",
        category: "experience",
        highlights: ["Traditional theatre", "Backstage talk", "Fridays and Saturdays"],
        photos: ["yakshagana"],
        policy: "Moderate",
        durationMinutes: 150,
        maxParticipants: 30,
        items: [{ name: "Auditorium seats (30)", capacity: 30 }],
        plan: { model: "per_person", base: 800, child: 400 },
        schedule: { times: ["19:00"], days: [5, 6], durationMinutes: 150 },
      },
    ],
  },
  {
    key: "malpe",
    owner: { email: "prakash@demo.example.com", phone: "9100000209", name: "Prakash Kotian" },
    business: { displayName: "Malpe Island Ferry", legalName: "Malpe Island Ferry (Demo)", type: "boat_operator", description: "Shared ferry rides from Malpe to the basalt-column island.", city: "Malpe", district: "Udupi", pincode: "576108", lat: 13.35, lng: 74.701 },
    destination: "udupi",
    categories: ["boating"],
    status: "approved",
    services: [
      {
        key: "malpe-ferry",
        title: "Island ferry from Malpe",
        summary: "Return ferry with two hours on the island.",
        description: "A shared ferry to the island's basalt rock formations, with time to explore before the return trip.",
        category: "boating",
        highlights: ["Return ferry", "2 hours on the island", "Large boat"],
        photos: ["malpe-sunrise", "mirjan-fort"],
        policy: "Flexible",
        durationMinutes: 180,
        maxParticipants: 40,
        weatherDependent: true,
        items: [{ name: "Ferry Sagarika (40 seats)", capacity: 40 }],
        plan: { model: "per_person", base: 350, child: 200 },
        schedule: { times: ["09:30", "11:30", "14:00"], durationMinutes: 180 },
      },
    ],
  },
  {
    key: "karwar-cottages",
    owner: { email: "deepa@demo.example.com", phone: "9100000210", name: "Deepa Naik" },
    business: { displayName: "Karwar Beach Cottages", legalName: "Karwar Beach Cottages (Demo)", type: "homestay", description: "Four cottages behind the dunes. Submitted for verification — documents await review in the demo.", city: "Karwar", district: "Uttara Kannada", pincode: "581301", lat: 14.81, lng: 74.125 },
    destination: "karwar",
    categories: ["stay"],
    status: "submitted",
    services: [
      {
        key: "karwar-cottages-rooms",
        title: "Karwar Beach Cottages",
        summary: "Cottages behind the dunes — awaiting verification.",
        description: "Pending listing: becomes bookable only after the partner is approved and the listing is published.",
        category: "stay",
        highlights: ["Beach access", "Cottages"],
        photos: ["karwar-beach"],
        policy: "Moderate",
        status: "pending_review",
        items: [{ name: "Cottage (3 guests)", units: 4, capacity: 3, price: { base: 3200, includedOccupancy: 2, extraAdult: 600 } }],
        plan: { model: "per_unit_per_night", base: 3200, includedOccupancy: 2, extraAdult: 600 },
      },
    ],
  },
  {
    key: "selfdrive",
    owner: { email: "kiran@demo.example.com", phone: "9100000211", name: "Kiran Pai" },
    business: { displayName: "Udupi Self Drive", legalName: "Udupi Self Drive (Demo)", type: "car_rental", description: "Self-drive hatchbacks. The verification team has asked for more information in the demo.", city: "Udupi", district: "Udupi", pincode: "576101", lat: 13.34, lng: 74.745 },
    destination: "udupi",
    categories: ["two_wheeler_rental"],
    status: "info_requested",
    services: [],
  },
];

/* ───────────────────────── helpers ───────────────────────── */

async function demoUser(input: { email: string; phone: string; name: string }, passwordHash: string, roleKeys: string[]) {
  return prisma.user.create({
    data: {
      email: input.email,
      emailVerified: new Date(),
      phone: `+91${input.phone}`,
      phoneVerified: new Date(),
      passwordHash,
      isDemo: true,
      profile: { create: { fullName: input.name, consentVersion: "demo", consentedAt: new Date() } },
      roles: { create: roleKeys.map((key) => ({ role: { connect: { key } } })) },
    },
  });
}

async function setGeo(table: "providers" | "service_locations" | "destinations", id: string, lat: number, lng: number) {
  const sql =
    table === "providers"
      ? prisma.$executeRaw`UPDATE providers SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography WHERE id = ${id}::uuid`
      : prisma.$executeRaw`UPDATE service_locations SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography WHERE id = ${id}::uuid`;
  await sql;
}

const photoAsset = new Map<string, string>();
async function mediaFor(photo: string) {
  const existing = photoAsset.get(photo);
  if (existing) return existing;
  const m = await prisma.mediaAsset.create({
    data: { bucket: "static", objectKey: `/images/photos/${photo}.jpg`, visibility: "public", mimeType: "image/jpeg", sizeBytes: 0, sha256: "0".repeat(64), altText: photo.replace(/-/g, " "), verifiedAt: new Date() },
  });
  photoAsset.set(photo, m.id);
  return m.id;
}

async function main() {
  if (await prisma.user.findUnique({ where: { email: ADMINS[0].email } })) {
    console.log("Demo data is already loaded. To reload it from scratch run: pnpm db:reset:demo");
    return;
  }
  const roles = await prisma.role.count();
  if (roles === 0) throw new Error("Run the reference seed first: pnpm db:seed");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const categories = new Map((await prisma.category.findMany()).map((c) => [c.key, c]));
  const destinations = new Map((await prisma.destination.findMany()).map((d) => [d.slug, d]));
  const policies = new Map((await prisma.cancellationPolicy.findMany({ where: { providerId: null } })).map((p) => [p.name, p]));
  const docTypes = await prisma.documentType.findMany({ include: { requirements: { include: { category: true } } } });

  /* Platform configuration (demo values). */
  await prisma.$transaction([
    prisma.systemSetting.upsert({ where: { key: "pricing.platform_fee" }, create: { key: "pricing.platform_fee", value: { label: "Convenience fee", flatAmount: rupees(29), taxRateBps: 1800 } }, update: {} }),
    prisma.systemSetting.upsert({ where: { key: "finance.commission_tax_bps" }, create: { key: "finance.commission_tax_bps", value: 1800 }, update: {} }),
    prisma.systemSetting.upsert({ where: { key: "finance.withholdings" }, create: { key: "finance.withholdings", value: [{ code: "GST_TCS", label: "GST TCS (demo rate)", rateBps: 50, base: "service_value" }] }, update: {} }),
    prisma.systemSetting.upsert({ where: { key: "demo.notice" }, create: { key: "demo.notice", value: "Tax, commission and fee values are demo configuration — confirm with finance and tax advisors before launch." }, update: {} }),
  ]);
  const taxValidFrom = new Date("2025-01-01T00:00:00Z");
  const tax = (cat: string, label: string, rateBps: number, min?: number, max?: number) =>
    prisma.taxRule.create({ data: { categoryId: categories.get(cat)!.id, code: "GST", label, rateBps, validFrom: taxValidFrom, ...(min !== undefined ? { minUnitAmount: min } : {}), ...(max !== undefined ? { maxUnitAmount: max } : {}) } });
  await tax("stay", "GST (demo rate)", 500, undefined, rupees(7500));
  await tax("stay", "GST (demo rate)", 1800, rupees(7500));
  for (const c of ["boating", "water_sports", "adventure", "experience", "guide", "two_wheeler_rental"]) await tax(c, "GST (demo rate)", 1800);
  await tax("taxi", "GST (demo rate)", 500);
  await prisma.commissionRule.createMany({
    data: [
      { rateBps: 1200, priority: 0, note: "Default commission (demo)" },
      { categoryKey: "stay", rateBps: 1500, priority: 0, note: "Stays (demo)" },
      { categoryKey: "taxi", rateBps: 1000, priority: 0, note: "Cabs (demo)" },
    ],
  });

  /* Destinations go live for the demo. */
  for (const d of destinations.values()) {
    await prisma.destination.update({ where: { id: d.id }, data: { status: "active", launchedAt: new Date(`${day(-60)}T00:00:00Z`) } });
  }

  /* Admins and travellers. */
  const admins = new Map<string, string>();
  for (const a of ADMINS) admins.set(a.role, (await demoUser(a, passwordHash, ["traveler", a.role])).id);
  const travellers = [] as { id: string; name: string; phone: string }[];
  for (const t of TRAVELLERS) travellers.push({ id: (await demoUser(t, passwordHash, ["traveler"])).id, name: t.name, phone: `+91${t.phone}` });
  const verifierId = admins.get("verification_admin")!;

  /* Partners, documents, listings, inventory and schedules. */
  const servicesByKey = new Map<string, { id: string; slug: string; providerId: string; ownerId: string; spec: ServiceSpec; itemIds: string[] }>();
  for (const p of PARTNERS) {
    const owner = await demoUser(p.owner, passwordHash, ["traveler"]);
    const dest = destinations.get(p.destination)!;
    const created = new Date(`${day(p.status === "approved" ? -75 : -4)}T05:00:00Z`);
    const provider = await prisma.provider.create({
      data: {
        slug: `${p.key}-demo`,
        legalName: p.business.legalName,
        displayName: p.business.displayName,
        businessType: p.business.type,
        description: p.business.description,
        contactEmail: p.owner.email,
        contactPhone: `+91${p.owner.phone}`,
        addressLine1: "Demo address — fictional business",
        city: p.business.city,
        district: p.business.district,
        pincode: p.business.pincode,
        status: p.status,
        submittedAt: created,
        approvedAt: p.status === "approved" ? new Date(created.getTime() + 2 * 86_400_000) : null,
        isDemo: true,
        createdAt: created,
        members: { create: [{ userId: owner.id, role: "owner", status: "active" }] },
        categories: { create: p.categories.map((key) => ({ categoryId: categories.get(key)!.id, status: p.status === "approved" ? "approved" : "pending", reviewedBy: p.status === "approved" ? verifierId : null, reviewedAt: p.status === "approved" ? created : null })) },
        destinations: { create: [{ destinationId: dest.id }] },
        payoutAccounts: { create: [{ accountHolderName: p.business.legalName, bankAccountLast4: String(between(1000, 9999)), ifsc: "DEMO0000001", isPrimary: true, verifiedAt: p.status === "approved" ? created : null }] },
      },
    });
    await setGeo("providers", provider.id, p.business.lat, p.business.lng);
    for (const s of p.staff ?? []) {
      const u = await demoUser(s, passwordHash, ["traveler"]);
      await prisma.providerMember.create({ data: { providerId: provider.id, userId: u.id, role: s.role, status: "active", displayName: s.name } });
    }

    // Verification history + business documents.
    const events: Prisma.ProviderVerificationEventCreateManyInput[] = [
      { providerId: provider.id, actorId: owner.id, event: "application_created", toStatus: "draft", createdAt: created },
      { providerId: provider.id, actorId: owner.id, event: "application_submitted", fromStatus: "draft", toStatus: "submitted", createdAt: new Date(created.getTime() + 3_600_000) },
    ];
    if (p.status !== "submitted") events.push({ providerId: provider.id, actorId: verifierId, event: "review_started", fromStatus: "submitted", toStatus: "under_review", createdAt: new Date(created.getTime() + 86_400_000) });
    if (p.status === "approved") events.push({ providerId: provider.id, actorId: verifierId, event: "application_approved", fromStatus: "under_review", toStatus: "approved", message: "Welcome aboard — your documents are verified.", createdAt: new Date(created.getTime() + 2 * 86_400_000) });
    if (p.status === "info_requested")
      events.push({ providerId: provider.id, actorId: verifierId, event: "info_requested", fromStatus: "under_review", toStatus: "info_requested", message: "The vehicle insurance document is unreadable. Please upload a clearer copy.", internalNote: "Scan is blurred on page 2.", createdAt: new Date(created.getTime() + 2 * 86_400_000) });
    await prisma.providerVerificationEvent.createMany({ data: events });

    const needed = docTypes.filter((d) => ["business", "owner"].includes(d.subject) && d.requirements.some((r) => p.categories.includes(r.category.key)));
    for (const d of needed) {
      const media = await prisma.mediaAsset.create({
        data: { bucket: "kt-private", objectKey: `demo/${p.key}/${d.key}.pdf`, visibility: "private", mimeType: "application/pdf", sizeBytes: 120_000, sha256: "0".repeat(64), uploadedBy: owner.id, verifiedAt: new Date() },
      });
      const status = p.status === "approved" ? "verified" : p.status === "info_requested" && d.key === "liability_insurance" ? "rejected" : "pending";
      await prisma.providerDocument.create({
        data: {
          providerId: provider.id,
          documentTypeId: d.id,
          mediaId: media.id,
          documentNumber: d.requiresNumber ? `DEMO-${d.key.slice(0, 4).toUpperCase()}-${between(10000, 99999)}` : null,
          issuedOn: new Date(`${day(-400)}T00:00:00Z`),
          expiresOn: d.requiresExpiry ? new Date(`${day(p.key === "omcoast" && d.key === "boat_operator_permit" ? 20 : 330)}T00:00:00Z`) : null,
          status,
          reviewedBy: status === "pending" ? null : verifierId,
          reviewedAt: status === "pending" ? null : created,
          rejectionReason: status === "rejected" ? "Unreadable scan — please upload a clearer copy." : null,
          uploadedBy: owner.id,
          createdAt: created,
        },
      });
    }

    for (const spec of p.services) {
      const category = categories.get(spec.category)!;
      const policy = policies.get(spec.policy)!;
      // "From" price a traveller can actually pay: the minimum fare for metered cabs, otherwise the cheapest base price.
      const fromPrice = spec.plan.model === "distance_based" ? rupees(Math.max(spec.plan.base, spec.plan.minimumFare ?? 0)) : rupees(Math.min(spec.plan.base, ...spec.items.map((i) => i.price?.base ?? spec.plan.base)));
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          categoryId: category.id,
          destinationId: dest.id,
          slug: spec.key,
          title: spec.title,
          summary: spec.summary,
          description: spec.description,
          highlights: spec.highlights,
          inclusions: spec.inclusions ?? [],
          exclusions: spec.exclusions ?? [],
          attributes: (spec.attributes ?? {}) as Prisma.InputJsonValue,
          languages: spec.languages ?? [],
          durationMinutes: spec.durationMinutes ?? null,
          maxParticipants: spec.maxParticipants ?? null,
          minAge: spec.minAge ?? null,
          safetyInfo: spec.safetyInfo ?? null,
          weatherDependent: spec.weatherDependent ?? false,
          requiresLicence: spec.requiresLicence ?? false,
          confirmationPolicy: spec.confirmation ?? "instant",
          providerResponseMins: spec.providerResponseMins ?? 720,
          minLeadMinutes: 60,
          cancellationPolicyId: policy.id,
          status: spec.status ?? "published",
          fromPrice,
          isFeatured: ["seabreeze-rooms", "omcoast-sunset", "kali-sunset", "heritage-yakshagana"].includes(spec.key),
          publishedAt: (spec.status ?? "published") === "published" ? new Date(`${day(-70)}T00:00:00Z`) : null,
          isDemo: true,
          media: { create: await Promise.all(spec.photos.map(async (ph, i) => ({ mediaId: await mediaFor(ph), sortOrder: i, isCover: i === 0, approved: true }))) },
          reviewEvents: {
            create: [
              { actorId: owner.id, event: "listing_submitted", fromStatus: "draft", toStatus: "pending_review" },
              ...((spec.status ?? "published") === "published" ? [{ actorId: admins.get("operations_admin")!, event: "listing_publish", fromStatus: "pending_review" as const, toStatus: "published" as const }] : []),
            ],
          },
        },
      });
      for (const loc of spec.locations ?? []) {
        const id = (await prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO service_locations (id, service_id, kind, name, address_line, instructions, location, sort_order)
          VALUES (gen_random_uuid(), ${service.id}::uuid, ${loc.kind}::"ServiceLocationKind", ${loc.name}, ${loc.addressLine}, ${loc.instructions ?? null}, ST_SetSRID(ST_MakePoint(${loc.lng}, ${loc.lat}), 4326)::geography, 0)
          RETURNING id`)[0]!.id;
        void id;
      }

      const itemIds: string[] = [];
      for (const item of spec.items) {
        const inv = await prisma.inventoryItem.create({
          data: { providerId: provider.id, serviceId: service.id, name: item.name, totalUnits: item.units ?? 1, capacity: item.capacity, turnaroundMins: item.turnaroundMins ?? 0, tags: item.tags ?? [], attributes: (item.attributes ?? {}) as Prisma.InputJsonValue },
        });
        itemIds.push(inv.id);
        if (item.price) {
          const pr = { ...spec.plan, ...item.price };
          await prisma.pricePlan.create({
            data: {
              serviceId: service.id,
              inventoryItemId: inv.id,
              name: item.name,
              model: pr.model,
              baseAmount: rupees(pr.base),
              childAmount: pr.child !== undefined ? rupees(pr.child) : null,
              extraAdultAmount: pr.extraAdult !== undefined ? rupees(pr.extraAdult) : null,
              includedOccupancy: pr.includedOccupancy ?? null,
              depositPerUnit: pr.deposit !== undefined ? rupees(pr.deposit) : null,
              seasonalRules: spec.seasonal ? { create: [{ label: spec.seasonal.label, fromDate: new Date(`${day(-90)}T00:00:00Z`), toDate: new Date(`${day(180)}T00:00:00Z`), daysOfWeek: spec.seasonal.daysOfWeek, adjustmentBps: spec.seasonal.adjustmentBps, priority: 1 }] } : undefined,
            },
          });
        }
        if (spec.category === "boating" || spec.category === "water_sports") {
          const regType = docTypes.find((d) => d.key === "boat_registration")!;
          const media = await prisma.mediaAsset.create({ data: { bucket: "kt-private", objectKey: `demo/${p.key}/${inv.id}/boat_registration.pdf`, visibility: "private", mimeType: "application/pdf", sizeBytes: 90_000, sha256: "0".repeat(64), uploadedBy: owner.id, verifiedAt: new Date() } });
          await prisma.providerDocument.create({ data: { providerId: provider.id, documentTypeId: regType.id, inventoryItemId: inv.id, mediaId: media.id, documentNumber: `DEMO-BOAT-${between(1000, 9999)}`, expiresOn: new Date(`${day(300)}T00:00:00Z`), status: p.status === "approved" ? "verified" : "pending", uploadedBy: owner.id } });
        }
      }
      // A service-wide plan for models priced per service (boats per person, cabs, guides).
      if (!spec.items.some((i) => i.price)) {
        await prisma.pricePlan.create({
          data: {
            serviceId: service.id,
            name: "Standard",
            model: spec.plan.model,
            baseAmount: rupees(spec.plan.base),
            childAmount: spec.plan.child !== undefined ? rupees(spec.plan.child) : null,
            perKmAmount: spec.plan.perKm !== undefined ? rupees(spec.plan.perKm) : null,
            minimumFare: spec.plan.minimumFare !== undefined ? rupees(spec.plan.minimumFare) : null,
            depositPerUnit: spec.plan.deposit !== undefined ? rupees(spec.plan.deposit) : null,
          },
        });
      }

      if (spec.schedule) {
        await prisma.availabilityRule.create({ data: { serviceId: service.id, daysOfWeek: spec.schedule.days ?? [0, 1, 2, 3, 4, 5, 6], startTimes: spec.schedule.times, validFrom: new Date(`${day(-45)}T00:00:00Z`) } });
        const slots: Prisma.AvailabilitySlotCreateManyInput[] = [];
        for (let offset = -45; offset <= 30; offset++) {
          const date = day(offset);
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          if (spec.schedule.days && !spec.schedule.days.includes(dow)) continue;
          for (const time of spec.schedule.times) {
            const startsAt = istInstant(date, time);
            const weather = spec.weatherDependent && offset === 2 && time === spec.schedule.times[0];
            slots.push({
              inventoryItemId: itemIds[0]!,
              date: new Date(`${date}T00:00:00Z`),
              startsAt,
              endsAt: new Date(startsAt.getTime() + spec.schedule.durationMinutes * 60_000),
              capacity: spec.items[0]!.capacity,
              status: weather ? "weather_hold" : "open",
              statusReason: weather ? "High swell forecast (demo)" : null,
            });
          }
        }
        await prisma.availabilitySlot.createMany({ data: slots });
      }
      if (spec.category === "stay") {
        await prisma.blackoutDate.create({ data: { serviceId: service.id, date: new Date(`${day(21)}T00:00:00Z`), reason: "Family function (demo)" } });
      }
      servicesByKey.set(spec.key, { id: service.id, slug: spec.key, providerId: provider.id, ownerId: owner.id, spec, itemIds });
    }
  }

  await prisma.coupon.createMany({
    data: [
      { code: "COAST10", kind: "percent", percentBps: 1000, maxDiscount: rupees(300), fundedBy: "platform", validFrom: new Date(`${day(-60)}T00:00:00Z`), validTo: new Date(`${day(120)}T00:00:00Z`), maxRedemptions: 500, perUserLimit: 2 },
      { code: "SEABREEZE500", kind: "fixed", amount: rupees(500), minSubtotal: rupees(5000), fundedBy: "provider", providerId: servicesByKey.get("seabreeze-rooms")!.providerId, categoryKey: "stay", validFrom: new Date(`${day(-60)}T00:00:00Z`), validTo: new Date(`${day(90)}T00:00:00Z`) },
    ],
  });

  /* ───────────── bookings through the real engine, on a simulated clock ───────────── */

  const at = (d: string, time: string) => istInstant(d, time);
  const setClock = (d: Date) => {
    engine.now = () => d;
  };

  async function slotOn(serviceKey: string, date: string, time?: string) {
    const s = servicesByKey.get(serviceKey)!;
    const slots = await prisma.availabilitySlot.findMany({ where: { inventoryItem: { serviceId: s.id }, date: new Date(`${date}T00:00:00Z`), status: "open" }, orderBy: { startsAt: "asc" } });
    return (time ? slots.find((x) => x.startsAt.getTime() === at(date, time).getTime()) : pick(slots))?.id;
  }

  async function requestFor(serviceKey: string, date: string): Promise<BookingRequest | null> {
    const s = servicesByKey.get(serviceKey)!;
    const adults = between(1, 3);
    const children = rand() < 0.3 ? 1 : 0;
    switch (s.spec.category) {
      case "stay": {
        const nights = between(1, 3);
        return { serviceSlug: s.slug, inventoryItemId: pick(s.itemIds), checkIn: date, checkOut: addDays(date, nights), units: 1, adults: Math.min(adults, 2), children: 0, ...(rand() < 0.2 ? { couponCode: "COAST10" } : {}) };
      }
      case "two_wheeler_rental":
        return { serviceSlug: s.slug, inventoryItemId: pick(s.itemIds), pickupAt: at(date, "09:00").toISOString(), returnAt: at(addDays(date, between(1, 3)), "09:00").toISOString(), units: 1, adults: 1 };
      case "taxi":
        return { serviceSlug: s.slug, date, startTime: pick(["07:30", "10:00", "15:30"]), routeId: pick(["station-town", "town-om", "town-murudeshwar"]), adults: between(1, 4) };
      case "guide":
        return { serviceSlug: s.slug, date, startTime: pick(["08:00", "15:00"]), adults: between(2, 5) };
      default: {
        const slotId = await slotOn(serviceKey, date);
        return slotId ? { serviceSlug: s.slug, slotId, adults, children } : null;
      }
    }
  }

  type Outcome = "completed" | "upcoming" | "requested" | "cancelled" | "weather" | "in_progress";
  const plan: { service: string; offset: number; traveller: number; outcome: Outcome }[] = [];
  const published = [...servicesByKey.values()].filter((s) => (s.spec.status ?? "published") === "published").map((s) => s.slug);
  for (let i = 0; i < 26; i++) plan.push({ service: pick(published), offset: -between(3, 40), traveller: i % TRAVELLERS.length, outcome: "completed" });
  for (let i = 0; i < 12; i++) plan.push({ service: pick(published.filter((k) => k !== "heritage-walk" && k !== "netrani-snorkel")), offset: between(2, 25), traveller: (i + 2) % TRAVELLERS.length, outcome: "upcoming" });
  plan.push({ service: "heritage-walk", offset: 5, traveller: 0, outcome: "requested" });
  plan.push({ service: "netrani-snorkel", offset: 9, traveller: 1, outcome: "requested" });
  plan.push({ service: "heritage-walk", offset: 12, traveller: 4, outcome: "requested" });
  plan.push({ service: "seabreeze-rooms", offset: 14, traveller: 2, outcome: "cancelled" });
  plan.push({ service: "kali-morning", offset: -12, traveller: 3, outcome: "cancelled" });
  plan.push({ service: "omcoast-sunset", offset: -8, traveller: 5, outcome: "weather" });
  plan.push({ service: "templeview-rooms", offset: -1, traveller: 0, outcome: "in_progress" });
  // Asha always has a confirmed trip coming up, for easy testing.
  plan.push({ service: "omcoast-sunset", offset: 3, traveller: 0, outcome: "upcoming" });
  plan.push({ service: "scooty-rental", offset: 3, traveller: 0, outcome: "upcoming" });

  const created: { id: string; reference: string; outcome: Outcome; travellerIdx: number; serviceKey: string }[] = [];
  let skipped = 0;
  for (const item of plan) {
    const date = day(item.offset);
    const s = servicesByKey.get(item.service)!;
    const traveller = travellers[item.traveller]!;
    // Bookings are made a few days ahead (or "now" for future trips).
    setClock(item.offset > 0 ? REAL_NOW : new Date(at(date, "06:00").getTime() - between(3, 12) * 86_400_000));
    const req = await requestFor(item.service, date);
    if (!req) {
      skipped++;
      continue;
    }
    try {
      const r = await engine.create(req, traveller.id, { guests: [{ fullName: traveller.name, phone: traveller.phone }] });
      if (s.spec.confirmation === "request") {
        if (item.outcome === "requested") {
          created.push({ id: r.bookingId, reference: r.reference, outcome: item.outcome, travellerIdx: item.traveller, serviceKey: item.service });
          continue;
        }
        setClock(new Date(engine.now().getTime() + 2 * 3_600_000));
        const accepted = await engine.providerAccept(r.bookingId, s.ownerId);
        await engine.confirmPayment(accepted.payment.id, `demo_pay_${r.reference}`);
      } else if (r.payment) {
        await engine.confirmPayment(r.payment.id, `demo_pay_${r.reference}`);
      }
      created.push({ id: r.bookingId, reference: r.reference, outcome: item.outcome, travellerIdx: item.traveller, serviceKey: item.service });
    } catch (e) {
      skipped++; // e.g. sold out on that date: real engine rules apply to demo data too
      if (process.env.DEMO_VERBOSE) console.warn(`skip ${item.service} ${date}: ${(e as Error).message}`);
    }
  }

  // Play the rest of each story forward.
  for (const b of created) {
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    const owner = servicesByKey.get(b.serviceKey)!.ownerId;
    if (b.outcome === "completed") {
      setClock(new Date(booking.endsAt.getTime() + 3_600_000));
      if (servicesByKey.get(b.serviceKey)!.spec.category === "stay") await engine.markStarted(b.id, owner);
      await engine.markCompleted(b.id, owner);
    } else if (b.outcome === "in_progress") {
      setClock(REAL_NOW);
      await engine.markStarted(b.id, owner);
    } else if (b.outcome === "cancelled") {
      setClock(new Date(booking.startsAt.getTime() - 5 * 86_400_000));
      await engine.cancel(b.id, "traveler", booking.travelerId!, "Plans changed (demo)");
    } else if (b.outcome === "weather") {
      setClock(new Date(booking.startsAt.getTime() - 3 * 3_600_000));
      await engine.cancel(b.id, "provider", owner, "Rough sea — ride cancelled for safety (demo)");
    }
  }
  setClock(REAL_NOW);

  /* Reviews for most completed bookings. */
  const REVIEW_TEXT: Record<number, { title: string; body: string }[]> = {
    5: [
      { title: "Wonderful experience", body: "Everything was on time and well organised. Would happily book again." },
      { title: "Highly recommended", body: "Friendly hosts, clear instructions and great value." },
      { title: "Loved it", body: "The highlight of our trip. Safety was taken seriously too." },
    ],
    4: [
      { title: "Very good", body: "Good experience overall. Pickup was a few minutes late but they kept us informed." },
      { title: "Nice and easy", body: "Smooth booking and a pleasant time. Small things to improve, but recommended." },
    ],
    3: [{ title: "Okay", body: "Decent, though it felt a little rushed. Fine for the price." }],
  };
  const completed = await prisma.booking.findMany({ where: { id: { in: created.filter((c) => c.outcome === "completed").map((c) => c.id) }, status: "completed" } });
  let reviews = 0;
  for (const b of completed) {
    if (rand() < 0.2) continue;
    const rating = pick([5, 5, 5, 4, 4, 3]);
    const text = pick(REVIEW_TEXT[rating]!);
    await prisma.review.create({
      data: {
        bookingId: b.id,
        serviceId: b.serviceId,
        providerId: b.providerId,
        userId: b.travelerId!,
        rating,
        title: text.title,
        body: text.body,
        response: rand() < 0.4 ? "Thank you for visiting! We hope to see you again." : null,
        respondedAt: null,
        createdAt: new Date(b.endsAt.getTime() + 86_400_000),
      },
    });
    reviews++;
  }
  for (const s of servicesByKey.values()) {
    const agg = await prisma.review.aggregate({ where: { serviceId: s.id }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.service.update({ where: { id: s.id }, data: { ratingAvg: agg._avg.rating ?? null, ratingCount: agg._count._all, viewCount: between(80, 900) } });
  }
  for (const pid of new Set([...servicesByKey.values()].map((s) => s.providerId))) {
    const agg = await prisma.review.aggregate({ where: { providerId: pid }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.provider.update({ where: { id: pid }, data: { ratingAvg: agg._avg.rating ?? null, ratingCount: agg._count._all } });
  }

  /* Payouts: settle everything that became eligible more than a week ago. */
  const cutoff = new Date(`${day(-7)}T00:00:00Z`);
  const eligible = await prisma.bookingSettlement.findMany({ where: { eligibleOn: { lte: cutoff }, payoutId: null }, include: { booking: { select: { providerId: true } } } });
  const byProvider = new Map<string, typeof eligible>();
  for (const s of eligible) byProvider.set(s.booking.providerId, [...(byProvider.get(s.booking.providerId) ?? []), s]);
  for (const [providerId, rows] of byProvider) {
    const account = await prisma.payoutAccount.findFirstOrThrow({ where: { providerId, isPrimary: true } });
    const dates = rows.map((r) => r.eligibleOn!.getTime());
    const payout = await prisma.payout.create({
      data: {
        providerId,
        payoutAccountId: account.id,
        periodStart: new Date(Math.min(...dates)),
        periodEnd: new Date(Math.max(...dates)),
        amount: rows.reduce((a, r) => a + r.netPayout + r.refundAdjustment, 0),
        status: "paid",
        gatewayPayoutRef: `demo_payout_${reference("ST").slice(3)}`,
        paidAt: new Date(`${day(-5)}T06:00:00Z`),
      },
    });
    await prisma.bookingSettlement.updateMany({ where: { bookingId: { in: rows.map((r) => r.bookingId) } }, data: { payoutId: payout.id } });
  }

  /* Support tickets. */
  const ref = (n: number) => `ST-DEMO${String(n).padStart(4, "0")}`;
  const anyBooking = (idx: number) => created.find((c) => c.travellerIdx === idx);
  const supportId = admins.get("support_admin")!;
  const tickets: { n: number; requester: string; subject: string; category: "refund" | "safety_incident" | "provider_complaint" | "account" | "booking"; priority: "low" | "normal" | "high" | "urgent"; status: "open" | "pending_customer" | "escalated" | "resolved"; bookingRef?: string; messages: { author: string | null; body: string; internal?: boolean }[]; incident?: Record<string, unknown> }[] = [
    {
      n: 1,
      requester: travellers[2]!.id,
      subject: "When will my refund reach my account?",
      category: "refund",
      priority: "normal",
      status: "pending_customer",
      bookingRef: created.find((c) => c.outcome === "cancelled")?.reference,
      messages: [
        { author: travellers[2]!.id, body: "I cancelled my stay last week. When will I get the refund?" },
        { author: supportId, body: "Your refund was processed on our side. Banks usually take 5–7 working days to show it. Could you confirm whether you see it now?" },
      ],
    },
    {
      n: 2,
      requester: travellers[1]!.id,
      subject: "Boat had too few life jackets on our ride",
      category: "safety_incident",
      priority: "urgent",
      status: "escalated",
      bookingRef: anyBooking(1)?.reference,
      incident: { severity: "high", reportedAt: new Date().toISOString(), location: "Boarding jetty (demo)" },
      messages: [
        { author: travellers[1]!.id, body: "Two people in our group did not get life jackets until we complained." },
        { author: supportId, body: "Thank you for reporting this. We have escalated it to our trust and safety team.", internal: false },
        { author: supportId, body: "Called the operator; they confirm a stock issue. Requesting photos of the jackets before the next ride.", internal: true },
      ],
    },
    {
      n: 3,
      requester: travellers[3]!.id,
      subject: "Cab arrived 30 minutes late",
      category: "provider_complaint",
      priority: "normal",
      status: "open",
      messages: [{ author: travellers[3]!.id, body: "The cab was 30 minutes late for our station pickup and the driver did not call." }],
    },
    {
      n: 4,
      requester: travellers[4]!.id,
      subject: "Can't change my phone number",
      category: "account",
      priority: "low",
      status: "resolved",
      messages: [
        { author: travellers[4]!.id, body: "How do I change the phone number on my account?" },
        { author: supportId, body: "We've updated it for you after verifying your identity. You can sign in with the new number now." },
      ],
    },
  ];
  for (const t of tickets) {
    const booking = t.bookingRef ? await prisma.booking.findUnique({ where: { reference: t.bookingRef } }) : null;
    await prisma.supportTicket.create({
      data: {
        reference: ref(t.n),
        requesterId: t.requester,
        assigneeId: t.status === "open" ? null : supportId,
        bookingId: booking?.id ?? null,
        providerId: booking?.providerId ?? null,
        category: t.category,
        priority: t.priority,
        status: t.status,
        subject: t.subject,
        incident: (t.incident ?? undefined) as Prisma.InputJsonValue | undefined,
        escalatedAt: t.status === "escalated" ? new Date() : null,
        resolvedAt: t.status === "resolved" ? new Date() : null,
        messages: { create: t.messages.map((m, i) => ({ authorId: m.author, body: m.body, isInternal: m.internal ?? false, createdAt: new Date(Date.now() - (t.messages.length - i) * 3_600_000) })) },
      },
    });
  }

  /* In-app notifications for travellers. */
  const recent = await prisma.booking.findMany({ where: { travelerId: { in: travellers.map((t) => t.id) }, status: { in: ["confirmed", "awaiting_provider_confirmation"] } }, include: { service: { select: { title: true } } } });
  await prisma.notification.createMany({
    data: recent.map((b) => ({
      userId: b.travelerId,
      event: b.status === "confirmed" ? "booking_confirmed" : "booking_requested",
      channel: "in_app" as const,
      recipient: b.travelerId!,
      payload: { title: b.status === "confirmed" ? "Booking confirmed" : "Request sent to partner", body: `${b.service.title} · ${b.reference}`, reference: b.reference },
      status: "sent" as const,
      sentAt: b.createdAt,
    })),
  });

  const counts = await prisma.booking.groupBy({ by: ["status"], _count: { _all: true }, where: { id: { in: created.map((c) => c.id) } } });
  console.log("Demo data loaded:");
  console.log(`  ${ADMINS.length} admins, ${TRAVELLERS.length} travellers, ${PARTNERS.length} partners, ${servicesByKey.size} listings`);
  console.log(`  ${created.length} bookings (${skipped} skipped by availability rules): ${counts.map((c) => `${c.status} ${c._count._all}`).join(", ")}`);
  console.log(`  ${reviews} reviews, ${byProvider.size} payouts, ${tickets.length} support tickets`);
  console.log(`  Password for every demo account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
