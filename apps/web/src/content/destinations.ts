import type { DestinationStatus } from "@/lib/catalog";

/**
 * EDITORIAL SEED CONTENT — development only.
 *
 * Mirrors the shape of the Destination CMS record (docs/06-data-model.md → destinations,
 * destination_attractions, cms faqs). In production this is read from the API and edited
 * in the admin CMS. Copy is deliberately conservative: no invented distances, statistics,
 * prices or claims about available services. Service availability is ALWAYS derived from
 * verified provider inventory, never from this file.
 *
 * Remove by deleting this file once GET /destinations is wired.
 */

export interface Attraction {
  name: string;
  kind: "temple" | "beach" | "island" | "fort" | "museum" | "nature" | "food" | "town";
  description: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface DestinationContent {
  slug: string;
  name: string;
  district: string;
  state: string;
  status: DestinationStatus;
  /** One-line hook used on cards. */
  summary: string;
  /** Short display line for the hero. */
  headline: string;
  overview: string[];
  attractions: Attraction[];
  travelTips: string[];
  faqs: Faq[];
  /** Licensed image path under /public/images (credits: content/photos.ts, /photo-credits). */
  image: string | null;
  scene: "coast" | "backwater" | "hills" | "temple" | "road" | "forest";
  seo: { title: string; description: string };
}

const commonTips = [
  "The south-west monsoon (roughly June to September) brings heavy rain and rough seas; many boat rides and water sports pause during this period.",
  "Dress modestly when visiting temples. Some temples have specific dress codes and photography rules — follow the notices at the entrance.",
  "Before any boat ride or water activity, check that life jackets are provided and that the operator briefs you on safety.",
  "To rent a scooty, bike or car, carry your original driving licence. Rental businesses may ask for a refundable deposit.",
];

export const destinations: DestinationContent[] = [
  {
    slug: "gokarna",
    name: "Gokarna",
    district: "Uttara Kannada",
    state: "Karnataka",
    status: "onboarding",
    summary: "A temple town with a string of quiet beaches linked by coastal trails.",
    headline: "Temple bells, headland trails and crescent beaches.",
    overview: [
      "Gokarna is a pilgrimage town on the Uttara Kannada coast, centred on the Mahabaleshwar Temple and its old streets of traditional houses.",
      "South of town, a line of beaches — Kudle, Om, Half Moon and Paradise — sit between rocky headlands. Footpaths over the cliffs connect several of them, and boats also run between beaches when the sea allows.",
    ],
    attractions: [
      { name: "Mahabaleshwar Temple", kind: "temple", description: "The town's principal temple and the focus of Gokarna's pilgrimage traditions." },
      { name: "Gokarna Beach", kind: "beach", description: "The main town beach, close to the temple and market streets." },
      { name: "Kudle Beach", kind: "beach", description: "A long curve of sand south of town, popular for sunsets." },
      { name: "Om Beach", kind: "beach", description: "Named for its shape, with rocky outcrops at each end." },
      { name: "Half Moon and Paradise beaches", kind: "beach", description: "Smaller coves reached on foot over the headland trail or by boat." },
    ],
    travelTips: [
      ...commonTips,
      "Headland trails between beaches are uneven and can be slippery after rain. Start early and carry water.",
    ],
    faqs: [
      {
        question: "Can I book boat rides between beaches?",
        answer: "Boat rides are listed only by operators who have completed verification. When none are listed for your dates, no verified operator currently offers that ride on this platform.",
      },
      {
        question: "Do I need a guide for the beach trail?",
        answer: "Many visitors walk it independently. A local guide can help with route choice, timing and the town's temple history.",
      },
    ],
    image: "/images/photos/gokarna-om-beach.jpg",
    scene: "coast",
    seo: {
      title: "Gokarna: places to visit, beaches, stays and boat rides",
      description: "Plan a Gokarna trip: Om, Kudle, Half Moon and Paradise beaches, the Mahabaleshwar Temple, and verified stays, boat rides, scooty rentals and guides.",
    },
  },
  {
    slug: "murudeshwar",
    name: "Murudeshwar",
    district: "Uttara Kannada",
    state: "Karnataka",
    status: "onboarding",
    summary: "A seaside temple on Kanduka Hill, facing the Arabian Sea.",
    headline: "A hilltop temple at the edge of the sea.",
    overview: [
      "Murudeshwar is a coastal temple town in Bhatkal taluk. The Murudeshwar Temple stands on Kanduka Hill, surrounded on three sides by the sea, with a tall statue of Lord Shiva overlooking the shore.",
      "Netrani Island lies offshore and is known for its coral reef, which draws snorkelling and diving trips in suitable weather and seasons.",
    ],
    attractions: [
      { name: "Murudeshwar Temple", kind: "temple", description: "The temple complex and its towering gopura on Kanduka Hill." },
      { name: "Shiva statue", kind: "temple", description: "A large seated statue of Lord Shiva overlooking the coast." },
      { name: "Murudeshwar Beach", kind: "beach", description: "The beach beside the temple hill." },
      { name: "Netrani Island", kind: "island", description: "An offshore island with a reef visited on licensed snorkelling and diving trips." },
    ],
    travelTips: [
      ...commonTips,
      "Snorkelling and diving trips to Netrani depend on sea conditions and are only run by licensed operators. Confirm age, swimming and medical requirements before booking.",
    ],
    faqs: [
      {
        question: "Is diving at Netrani suitable for beginners?",
        answer: "Requirements are set by each licensed dive operator. Check the listing's age, health and experience requirements before booking.",
      },
    ],
    image: "/images/photos/murudeshwar-shiva-statue.jpg",
    scene: "temple",
    seo: {
      title: "Murudeshwar: temple, beach, Netrani Island trips and stays",
      description: "Plan a Murudeshwar trip: the temple on Kanduka Hill, the Shiva statue, the beach, licensed Netrani Island snorkelling trips and verified stays.",
    },
  },
  {
    slug: "karwar",
    name: "Karwar",
    district: "Uttara Kannada",
    state: "Karnataka",
    status: "onboarding",
    summary: "Where the Kali river meets the sea, with islands just offshore.",
    headline: "River mouth, island hops and quiet beaches.",
    overview: [
      "Karwar is the headquarters of Uttara Kannada district, set where the Kali river reaches the Arabian Sea with the Western Ghats rising behind the town.",
      "The coastline includes Rabindranath Tagore Beach in town and Devbagh to the north, while small islands such as Kurumgad sit offshore and are reached by boat in suitable weather.",
    ],
    attractions: [
      { name: "Rabindranath Tagore Beach", kind: "beach", description: "The town beach, with a promenade and the warship museum nearby." },
      { name: "Warship museum", kind: "museum", description: "A decommissioned naval vessel on the seafront that is open to visitors." },
      { name: "Devbagh Beach", kind: "beach", description: "A quieter stretch of sand near the river mouth." },
      { name: "Kurumgad Island", kind: "island", description: "A small island reached by boat when sea conditions allow." },
      { name: "Sadashivgad Fort", kind: "fort", description: "A hill fort overlooking the Kali river bridge." },
    ],
    travelTips: [...commonTips],
    faqs: [
      {
        question: "How do I get to the islands?",
        answer: "Island trips are run by boat operators. Verified operators list their departure points, schedules and safety requirements here once approved.",
      },
    ],
    image: "/images/photos/karwar-kali-river.jpg",
    scene: "backwater",
    seo: {
      title: "Karwar: places to visit, Kali river, beaches and islands",
      description: "Plan a Karwar trip: Rabindranath Tagore Beach, the Kali river mouth, Sadashivgad Fort, island boat trips, and verified stays and cabs.",
    },
  },
  {
    slug: "udupi",
    name: "Udupi",
    district: "Udupi",
    state: "Karnataka",
    status: "onboarding",
    summary: "The Krishna Matha, Malpe's beaches and the basalt columns of St Mary's Island.",
    headline: "Temple kitchens, harbour mornings and basalt isles.",
    overview: [
      "Udupi is a temple town known for the Sri Krishna Matha and for a vegetarian cooking tradition that has spread across India.",
      "Nearby Malpe has a busy fishing harbour and a long beach, and boats run from Malpe to St Mary's Island, known for its columnar basalt rock formations, when the season and sea allow.",
    ],
    attractions: [
      { name: "Sri Krishna Matha", kind: "temple", description: "The temple and monastery at the heart of Udupi." },
      { name: "Malpe Beach", kind: "beach", description: "A wide beach next to the Malpe fishing harbour." },
      { name: "St Mary's Island", kind: "island", description: "Small islands with distinctive columnar basalt, reached by boat from Malpe in season." },
      { name: "Udupi cuisine", kind: "food", description: "Temple-town vegetarian food served in long-standing local eateries." },
    ],
    travelTips: [
      ...commonTips,
      "Boats to St Mary's Island do not run during the monsoon. Check the listing's season and weather notes before booking.",
    ],
    faqs: [
      {
        question: "Can I combine a stay, a scooty and a boat ride in one booking?",
        answer: "Yes — add each service to a single trip. Each component is booked with its own provider, confirmation and cancellation policy, shown before you pay.",
      },
    ],
    image: "/images/photos/udupi-krishna-matha.jpg",
    scene: "temple",
    seo: {
      title: "Udupi: Krishna Matha, Malpe Beach and St Mary's Island",
      description: "Plan an Udupi trip: the Sri Krishna Matha, Malpe Beach, boats to St Mary's Island in season, and verified stays, rentals and guides.",
    },
  },
];

export function getDestination(slug: string): DestinationContent | undefined {
  return destinations.find((d) => d.slug === slug);
}

/** The launch towns in the order you reach them travelling down the coast, north to south. */
const COAST_ORDER = ["karwar", "gokarna", "murudeshwar", "udupi"];

export function destinationsNorthToSouth(): DestinationContent[] {
  const rank = (slug: string) => {
    const i = COAST_ORDER.indexOf(slug);
    return i === -1 ? COAST_ORDER.length : i;
  };
  return [...destinations].sort((a, b) => rank(a.slug) - rank(b.slug));
}
