import type { ServiceCategoryKey } from "@/lib/catalog";

/**
 * Public "shelves" — how service categories are grouped for travellers.
 * Each shelf has a landing route and maps to one or more domain category keys.
 */
export interface CategoryShelf {
  slug: "stays" | "boating" | "rentals" | "cabs" | "guides" | "experiences" | "packages";
  href: `/${string}`;
  label: string;
  /** Short line used on cards and nav. */
  blurb: string;
  /** Editorial intro for the landing page. */
  intro: string;
  categories: ServiceCategoryKey[];
  /** What a traveller chooses when searching this shelf. */
  searchHints: string[];
  /** Licensed photo for cards and landing pages (credits: content/photos.ts). */
  image: string;
  /** Fallback art scene for MediaFrame. */
  scene: "coast" | "backwater" | "hills" | "temple" | "road" | "forest";
  emptyMessage: string;
}

export const categoryShelves: CategoryShelf[] = [
  {
    slug: "stays",
    href: "/stays",
    label: "Stays",
    blurb: "Hotels, resorts, homestays and cottages",
    intro:
      "Beach cottages, family-run homestays and hotels near temple towns. Compare room types, meal plans and check-in policies set by each property.",
    categories: ["stay"],
    searchHints: ["Check-in and check-out", "Rooms and guests", "Meal plan"],
    scene: "coast",
    image: "/images/photos/homestay-veranda.jpg",
    emptyMessage: "Stays appear here once local properties have been verified and their rooms approved.",
  },
  {
    slug: "boating",
    href: "/boating",
    label: "Boating",
    blurb: "Boat rides, ferries and water sports",
    intro:
      "Shared and private boat rides, river and backwater trips and beach water sports run by licensed local operators. Departures depend on weather and sea conditions.",
    categories: ["boating", "water_sports"],
    searchHints: ["Departure slot", "Shared or private", "Number of riders"],
    scene: "backwater",
    image: "/images/photos/boat-ride-sunset.jpg",
    emptyMessage: "Boat rides appear here once operators have completed licence and safety-document checks.",
  },
  {
    slug: "rentals",
    href: "/rentals",
    label: "Rentals",
    blurb: "Scooty, bike and self-drive cars",
    intro:
      "Pick up a scooty, motorbike or self-drive car for your stay. Rentals need a valid driving licence; deposit and fuel rules are set by each rental business.",
    categories: ["two_wheeler_rental", "car_rental"],
    searchHints: ["Pickup and return time", "Vehicle type", "Pickup point"],
    scene: "road",
    image: "/images/photos/scooter.jpg",
    emptyMessage: "Rentals appear here once rental businesses have verified vehicle registration and insurance.",
  },
  {
    slug: "cabs",
    href: "/cabs",
    label: "Cabs & transport",
    blurb: "Local taxis, autos and outstation cabs",
    intro:
      "Airport and station pickups, day sightseeing cabs, autos for short hops and outstation trips with a fare breakdown before you book.",
    categories: ["taxi", "auto"],
    searchHints: ["Pickup and drop", "Trip date and time", "Passengers"],
    scene: "road",
    image: "/images/photos/nh66-kapu.jpg",
    emptyMessage: "Cabs and autos appear here once drivers and vehicles have been verified.",
  },
  {
    slug: "guides",
    href: "/guides",
    label: "Guides",
    blurb: "Local guides by language and expertise",
    intro:
      "Half-day and full-day guides who know the temples, beaches, food and history of the coast. Filter by language and expertise.",
    categories: ["guide"],
    searchHints: ["Date", "Half or full day", "Language"],
    scene: "temple",
    image: "/images/photos/gokarna-koti-teertha.jpg",
    emptyMessage: "Guides appear here once their identity and credentials have been verified.",
  },
  {
    slug: "experiences",
    href: "/experiences",
    label: "Experiences",
    blurb: "Adventure, culture and sightseeing",
    intro:
      "Treks, kayaking, snorkelling, cooking sessions, craft walks and sightseeing tours with clear group sizes, age limits and safety requirements.",
    categories: ["adventure", "experience", "sightseeing"],
    searchHints: ["Session date and time", "Participants", "Difficulty"],
    scene: "forest",
    image: "/images/photos/yakshagana.jpg",
    emptyMessage: "Experiences appear here once activity operators have been verified and sessions published.",
  },
  {
    slug: "packages",
    href: "/packages",
    label: "Packages",
    blurb: "Curated multi-day trips",
    intro:
      "Multi-day trips that bundle stays, transport and activities from verified partners, with each component and its policy shown before you pay.",
    categories: ["package"],
    searchHints: ["Start date", "Travellers", "Duration"],
    scene: "hills",
    image: "/images/photos/mirjan-fort.jpg",
    emptyMessage: "Packages appear here once tour operators publish verified itineraries.",
  },
];

export function getShelf(slug: CategoryShelf["slug"]): CategoryShelf {
  const shelf = categoryShelves.find((s) => s.slug === slug);
  if (!shelf) throw new Error(`Unknown category shelf: ${slug}`);
  return shelf;
}
