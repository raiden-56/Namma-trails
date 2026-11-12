import type { CategoryShelf } from "./categories";

/**
 * Search keywords for the public pages.
 *
 * How they were chosen (November 2026): from the titles of the travel guides, tourism
 * board pages and booking pages that rank for this coast ("things to do in Gokarna",
 * "places to visit in Karwar", "Netrani Island snorkelling", "St Mary's Island boat",
 * "coastal Karnataka itinerary", "Uttara Kannada tourist places" and similar), limited
 * to places and services this site really covers.
 *
 * How they are used: as the vocabulary for page titles, descriptions and headings, and
 * as <meta name="keywords">. Search engines read the titles, descriptions, headings and
 * page text; most ignore the keywords tag, so the lists stay short and specific. Never
 * add a keyword for a place or a service the site does not have.
 */

/** Site-wide: what the marketplace is, in the words people search with. */
export const siteKeywords = [
  "coastal Karnataka trip",
  "Karnataka coast tourism",
  "Gokarna trip",
  "Murudeshwar trip",
  "Karwar tourism",
  "Udupi tourism",
  "Uttara Kannada tourist places",
  "Karnataka beach holiday",
  "homestays in Gokarna",
  "boat rides in Gokarna",
  "scooty rental in Gokarna",
  "local guides Karnataka coast",
  "coastal Karnataka itinerary",
];

/** Per launch town: place names and the usual "places to visit / things to do" searches. */
export const destinationKeywords: Record<string, string[]> = {
  gokarna: [
    "Gokarna trip",
    "places to visit in Gokarna",
    "things to do in Gokarna",
    "Gokarna beaches",
    "Om Beach",
    "Kudle Beach",
    "Half Moon Beach",
    "Paradise Beach Gokarna",
    "Gokarna beach trek",
    "Mahabaleshwar Temple",
    "Gokarna homestay",
    "scooty rental in Gokarna",
    "boat ride in Gokarna",
  ],
  murudeshwar: [
    "Murudeshwar trip",
    "places to visit in Murudeshwar",
    "Murudeshwar Temple",
    "Murudeshwar Shiva statue",
    "Murudeshwar Beach",
    "Netrani Island",
    "Netrani Island snorkelling",
    "scuba diving near Murudeshwar",
    "hotels in Murudeshwar",
  ],
  karwar: [
    "Karwar trip",
    "places to visit in Karwar",
    "things to do in Karwar",
    "Karwar beach",
    "Rabindranath Tagore Beach",
    "Devbagh Beach",
    "Kali river Karwar",
    "Kurumgad Island",
    "Sadashivgad Fort",
    "Karwar boat ride",
  ],
  udupi: [
    "Udupi trip",
    "places to visit in Udupi",
    "Sri Krishna Matha",
    "Udupi Krishna temple",
    "Malpe Beach",
    "St Mary's Island",
    "St Mary's Island boat",
    "Udupi food",
    "stays in Udupi",
  ],
};

/** Per service category: a search-friendly title, a short description and keywords. */
export const shelfSeo: Record<CategoryShelf["slug"], { title: string; description: string; keywords: string[] }> = {
  stays: {
    title: "Stays in Gokarna, Murudeshwar, Karwar and Udupi",
    description:
      "Hotels, resorts, homestays and beach cottages on the Karnataka coast from verified local hosts. Compare room types, meal plans and check-in policies.",
    keywords: ["Gokarna homestay", "hotels in Gokarna", "beach stay Gokarna", "hotels in Murudeshwar", "Karwar homestay", "stays in Udupi", "coastal Karnataka homestay"],
  },
  boating: {
    title: "Boat rides and water sports on the Karnataka coast",
    description:
      "Shared and private boat rides, river trips and beach water sports in Gokarna, Murudeshwar, Karwar and Udupi, run by licensed local operators.",
    keywords: ["boat ride in Gokarna", "Karwar boating", "Malpe boat ride", "St Mary's Island boat", "Netrani Island trip", "water sports Karnataka coast"],
  },
  rentals: {
    title: "Scooty, bike and car rentals in coastal Karnataka",
    description:
      "Rent a scooty, motorbike or self-drive car in Gokarna, Murudeshwar, Karwar and Udupi. See the deposit and fuel rules before you book.",
    keywords: ["scooty rental in Gokarna", "bike rental in Gokarna", "two-wheeler rental Murudeshwar", "bike rental in Udupi", "self-drive car Udupi", "Karwar bike rental"],
  },
  cabs: {
    title: "Cabs, taxis and autos in coastal Karnataka",
    description:
      "Local taxis, autos, station pickups and day sightseeing cabs in Gokarna, Murudeshwar, Karwar and Udupi, with the fare shown before you book.",
    keywords: ["Gokarna taxi", "Karwar taxi", "Udupi cab", "sightseeing cab coastal Karnataka", "station pickup Gokarna", "outstation cab Karnataka coast"],
  },
  guides: {
    title: "Local guides in Gokarna, Murudeshwar, Karwar and Udupi",
    description:
      "Half-day and full-day local guides who know the temples, beaches, food and history of the Karnataka coast. Choose by language and expertise.",
    keywords: ["Gokarna local guide", "Udupi temple guide", "Karwar tour guide", "heritage walk Udupi", "Karnataka coast tour guide"],
  },
  experiences: {
    title: "Things to do on the Karnataka coast: treks, kayaking and culture",
    description:
      "Treks, kayaking, snorkelling, cooking sessions, craft walks and sightseeing tours in coastal Karnataka, with group sizes, age limits and safety notes.",
    keywords: ["things to do in Gokarna", "Gokarna beach trek", "kayaking in Karwar", "Netrani Island snorkelling", "Yakshagana Udupi", "sightseeing coastal Karnataka"],
  },
  packages: {
    title: "Coastal Karnataka tour packages",
    description:
      "Multi-day coastal Karnataka trips that bundle stays, transport and activities from verified partners, with each part and its policy shown before you pay.",
    keywords: ["coastal Karnataka tour package", "Gokarna Murudeshwar package", "Uttara Kannada tour package", "Karnataka beach holiday package"],
  },
};
