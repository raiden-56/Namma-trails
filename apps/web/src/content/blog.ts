import type { CategoryShelf } from "@/config/categories";
import type { PhotoKey } from "./photos";

/**
 * EDITORIAL SEED CONTENT — travel blog.
 *
 * Trip plans and sightseeing notes for the launch region. Like content/destinations.ts,
 * the copy is deliberately conservative: no distances, travel times, prices, opening
 * hours or claims about which services are available. Places named here are real;
 * what can be booked is ALWAYS derived from verified partner inventory, never from this
 * file. In production these articles move to the CMS (docs/09-routes.md → /blog).
 */

export interface PlanStop {
  /** "Early morning", "Day 3", … */
  when: string;
  title: string;
  body: string;
  /** Launch destination this stop belongs to (links to its guide page). */
  destination?: string;
}

export interface BlogPlan {
  title: string;
  note?: string;
  stops: PlanStop[];
}

export interface BlogSection {
  heading: string;
  paragraphs?: string[];
  items?: Array<{ name: string; text: string; destination?: string }>;
}

export interface BlogPost {
  slug: string;
  /** Short label shown on cards and above the title. */
  tag: string;
  /** One short line under the tag: what makes this plan or list particular. */
  detail: string;
  title: string;
  summary: string;
  lead: string[];
  image: PhotoKey;
  plans: BlogPlan[];
  sections: BlogSection[];
  tips: string[];
  /** Launch destinations the article covers. */
  destinations: string[];
  /** Kinds of service worth searching for this trip. */
  shelves: CategoryShelf["slug"][];
  /** Questions travellers search for, answered in one or two plain sentences. Shown on the page. */
  faqs: Array<{ question: string; answer: string }>;
  /** ISO date of the last edit. */
  updated: string;
  /** Search title, description and keywords (see config/seo.ts for how keywords are chosen). */
  seo: { title: string; description: string; keywords: string[] };
}

const monsoonTip =
  "The south-west monsoon (roughly June to September) brings heavy rain and rough seas. Many boat rides and water sports pause, and trails get slippery.";
const templeTip = "Dress modestly at temples and follow the notices at the entrance about dress and photography.";
const boatTip = "Before any boat ride, check that life jackets are provided and that the operator briefs you on safety.";
const bestTimeAnswer =
  "The months after the monsoon, roughly October to March, are the easiest: the sea is calmer and boats run. From about June to September heavy rain and rough seas stop most boat rides.";
const licenceTip = "To rent a scooty, bike or car, carry your original driving licence. The rental business may ask for a refundable deposit.";

export const blogPosts: BlogPost[] = [
  {
    slug: "one-day-in-gokarna",
    tag: "1-day trip",
    detail: "On foot, no car needed",
    title: "One day in Gokarna: temple town to sunset beach",
    summary: "A simple plan for a single day: the old temple streets in the morning, the headland trail to Om Beach, and the sunset at Kudle.",
    lead: [
      "Gokarna is small enough to enjoy in one day if you start early. The town sits around the Mahabaleshwar Temple, and a line of beaches runs south of it between rocky headlands.",
      "This plan needs no car. You walk in the morning, follow the cliff path in the afternoon, and can come back by boat or by road if your legs are tired.",
    ],
    image: "gokarna-om-beach",
    plans: [
      {
        title: "The day, step by step",
        stops: [
          {
            when: "Early morning",
            title: "Walk the temple town",
            body: "Start in the old streets around the Mahabaleshwar Temple while it is cool and quiet. The Koti Teertha temple tank is a short walk away.",
            destination: "gokarna",
          },
          {
            when: "Mid-morning",
            title: "Gokarna Beach",
            body: "The main town beach is close to the temple and market streets. It is a good place for breakfast and a slow start.",
            destination: "gokarna",
          },
          {
            when: "Late morning",
            title: "Over the headland to Kudle Beach",
            body: "A footpath climbs over the headland south of town and drops down to Kudle, a long curve of sand. The path is uneven, so wear proper shoes and carry water.",
            destination: "gokarna",
          },
          {
            when: "Afternoon",
            title: "On to Om Beach",
            body: "The next stretch of the trail leads to Om Beach, named for its shape, with rocky outcrops at each end. When the sea allows, boats also run between the beaches.",
            destination: "gokarna",
          },
          {
            when: "Late afternoon",
            title: "Half Moon and Paradise, if you have time",
            body: "Two smaller coves lie beyond Om Beach. You reach them on foot over the headland or by boat. Turn back early: the trails have no lighting.",
            destination: "gokarna",
          },
          {
            when: "Evening",
            title: "Sunset at Kudle",
            body: "Kudle Beach is popular for sunsets. Be back on the road or in town before dark.",
            destination: "gokarna",
          },
        ],
      },
    ],
    sections: [
      {
        heading: "Getting around for the day",
        paragraphs: [
          "The town and Gokarna Beach are best on foot. For the beaches you can walk the headland trail one way and return by road, or rent a scooty for the day.",
          "Autos and cabs can take you between the town and the road ends of the bigger beaches. A local guide is useful if you want the stories behind the temples.",
        ],
      },
      {
        heading: "If the sea is rough",
        paragraphs: [
          "In the monsoon, boats between the beaches stop and the cliff paths get slippery. Keep the day to the temple town, Gokarna Beach and Kudle, and leave the far coves for another visit.",
        ],
      },
    ],
    tips: [templeTip, "Headland trails are uneven and can be slippery after rain. Start early and carry water.", boatTip, licenceTip],
    destinations: ["gokarna"],
    shelves: ["rentals", "boating", "guides", "stays"],
    faqs: [
      {
        question: "Is one day enough for Gokarna?",
        answer: "One day is enough to see the temple town and walk to Kudle and Om Beach. To reach Half Moon and Paradise without rushing, or to add Yana, stay two or three days.",
      },
      {
        question: "Can I walk from Kudle Beach to Om Beach?",
        answer: "Yes. A footpath over the headland links the two beaches. It is uneven and can be slippery after rain, so wear proper shoes and carry water.",
      },
      { question: "What is the best time to visit Gokarna?", answer: bestTimeAnswer },
      {
        question: "Do I need a vehicle for one day in Gokarna?",
        answer: "Not for this plan. The town is walkable and the beaches are linked by a trail. A scooty helps if you want to move faster; carry your original driving licence to rent one.",
      },
    ],
    updated: "2026-11-12",
    seo: {
      title: "Gokarna 1-day itinerary: temple town, beach trek and sunset",
      description: "A simple one-day Gokarna itinerary: the Mahabaleshwar Temple, the beach trek from Kudle to Om Beach, Half Moon and Paradise, and sunset at Kudle.",
      keywords: ["Gokarna 1 day itinerary", "one day trip to Gokarna", "Gokarna beach trek", "Kudle Beach to Om Beach", "places to visit in Gokarna in one day", "things to do in Gokarna", "Gokarna sunset"],
    },
  },
  {
    slug: "seven-days-karwar-to-udupi",
    tag: "7-day plan",
    detail: "Four towns, north to south",
    title: "Seven days down the coast: Karwar to Udupi",
    summary: "A week that follows the coast from north to south: Karwar, Gokarna, a day at Yana and Mirjan Fort, Murudeshwar and Udupi.",
    lead: [
      "The four launch towns sit in a line along the coast, so a week is enough to see all of them without rushing. This plan starts in Karwar in the north and ends in Udupi in the south.",
      "The first six days are in Uttara Kannada district. The last day crosses into Udupi district. You can also run the plan the other way round.",
    ],
    image: "murudeshwar-shiva-statue",
    plans: [
      {
        title: "The week, day by day",
        note: "Boat rides, island trips and snorkelling depend on the season and the sea. Keep those days flexible.",
        stops: [
          {
            when: "Day 1",
            title: "Karwar: where the Kali river meets the sea",
            body: "Arrive and settle in. Walk the promenade at Rabindranath Tagore Beach, see the warship museum on the seafront, and watch the evening light at the river mouth.",
            destination: "karwar",
          },
          {
            when: "Day 2",
            title: "Karwar: river, fort and islands",
            body: "Spend the morning on or beside the Kali river. Sadashivgad Fort looks over the river bridge. Small islands such as Kurumgad are reached by boat when the sea allows.",
            destination: "karwar",
          },
          {
            when: "Day 3",
            title: "Gokarna: the temple town",
            body: "Travel south to Gokarna. Visit the Mahabaleshwar Temple and the Koti Teertha tank, then end the day on Gokarna Beach or at Kudle for the sunset.",
            destination: "gokarna",
          },
          {
            when: "Day 4",
            title: "Gokarna: the beach trail",
            body: "Walk the headland trail from Kudle to Om Beach, and on to Half Moon and Paradise if you like. Come back by boat when the sea is calm, or by road.",
            destination: "gokarna",
          },
          {
            when: "Day 5",
            title: "A day inland: Yana and Mirjan Fort",
            body: "Take a cab for the day. The Yana rocks are tall black rock formations in the forest of the Western Ghats, reached by a walk from the road. Mirjan Fort, near Kumta, has laterite walls and is at its greenest after the rains.",
          },
          {
            when: "Day 6",
            title: "Murudeshwar: the temple by the sea",
            body: "The Murudeshwar Temple stands on Kanduka Hill with the sea on three sides, beside a large statue of Lord Shiva. In suitable weather, licensed operators run snorkelling trips to Netrani Island.",
            destination: "murudeshwar",
          },
          {
            when: "Day 7",
            title: "Udupi and Malpe",
            body: "Visit the Sri Krishna Matha in the morning and eat a temple-town vegetarian meal. In the afternoon go to Malpe Beach. In season, boats run from Malpe to St Mary's Island, known for its columns of basalt rock.",
            destination: "udupi",
          },
        ],
      },
    ],
    sections: [
      {
        heading: "Moving between the towns",
        paragraphs: [
          "The coastal highway, NH 66, links all four towns, and the Konkan Railway runs close to the same line with stations at or near each of them.",
          "Inside each town a scooty is the easy way to get around. For Yana, Mirjan Fort and other day trips, a cab with a driver for the day is simpler.",
        ],
      },
      {
        heading: "If you have fewer days",
        paragraphs: [
          "For four days, keep two days in Gokarna, one in Murudeshwar and one in Udupi. For a weekend, choose one town and do it well: Gokarna for beaches and walking, Udupi for the temple, food and Malpe.",
        ],
      },
    ],
    tips: [monsoonTip, templeTip, boatTip, licenceTip],
    destinations: ["karwar", "gokarna", "murudeshwar", "udupi"],
    shelves: ["stays", "cabs", "boating", "rentals", "experiences"],
    faqs: [
      {
        question: "How many days do you need for coastal Karnataka?",
        answer: "A week covers Karwar, Gokarna, Murudeshwar and Udupi at an easy pace. With four days, keep Gokarna, Murudeshwar and Udupi.",
      },
      {
        question: "Which is the best route for a coastal Karnataka road trip?",
        answer: "Follow the coastal highway, NH 66, from Karwar in the north to Udupi in the south, or the other way round. The Konkan Railway runs close to the same line.",
      },
      { question: "When is the best time for a coastal Karnataka trip?", answer: bestTimeAnswer },
      {
        question: "Can I visit St Mary's Island and Netrani Island all year?",
        answer: "No. Boats to both depend on the season and the sea, and they do not run in the monsoon. Check the listing for its dates before you book.",
      },
    ],
    updated: "2026-11-12",
    seo: {
      title: "Coastal Karnataka 7-day itinerary: Karwar to Udupi",
      description: "A 7-day coastal Karnataka road trip plan: Karwar, Gokarna, Yana and Mirjan Fort, Murudeshwar, Udupi, Malpe and St Mary's Island, day by day.",
      keywords: ["coastal Karnataka itinerary", "coastal Karnataka road trip", "7 day Karnataka coast trip", "Karwar to Udupi road trip", "Gokarna Murudeshwar Udupi trip", "Karnataka beach road trip"],
    },
  },
  {
    slug: "sightseeing-on-the-karnataka-coast",
    tag: "Sightseeing",
    detail: "12 places",
    title: "Sightseeing on the coast: twelve places worth the stop",
    summary: "Temples, beaches, islands, a fort and the Yana rocks: twelve places to see in and around the four launch towns.",
    lead: [
      "You do not need a long list to enjoy this coast. These twelve places are the ones most visitors come for, grouped by what they are.",
      "Each town's guide page has more detail. A local guide can add the history and the stories.",
    ],
    image: "udupi-krishna-matha",
    plans: [],
    sections: [
      {
        heading: "Temples and temple towns",
        items: [
          { name: "Mahabaleshwar Temple, Gokarna", text: "The town's main temple and the centre of Gokarna's pilgrimage traditions.", destination: "gokarna" },
          { name: "Koti Teertha, Gokarna", text: "A large temple tank ringed by steps and small shrines, a short walk from the main temple.", destination: "gokarna" },
          {
            name: "Murudeshwar Temple and the Shiva statue",
            text: "A temple complex with a towering gopura on Kanduka Hill, and a large seated statue of Lord Shiva looking over the coast.",
            destination: "murudeshwar",
          },
          { name: "Sri Krishna Matha, Udupi", text: "The temple and monastery at the heart of Udupi, with the town's well-known vegetarian food all around it.", destination: "udupi" },
        ],
      },
      {
        heading: "Beaches and islands",
        items: [
          { name: "Om Beach, Gokarna", text: "A beach named for its shape, with rocky outcrops at each end.", destination: "gokarna" },
          { name: "Kudle Beach, Gokarna", text: "A long curve of sand south of town, popular at sunset.", destination: "gokarna" },
          { name: "Rabindranath Tagore Beach, Karwar", text: "The town beach, with a promenade and a warship museum on the seafront.", destination: "karwar" },
          { name: "Malpe Beach, near Udupi", text: "A wide beach beside a busy fishing harbour.", destination: "udupi" },
          { name: "St Mary's Island, off Malpe", text: "Small islands with unusual columns of basalt rock, reached by boat from Malpe in season.", destination: "udupi" },
        ],
      },
      {
        heading: "Forts, rocks and rivers",
        items: [
          { name: "Mirjan Fort, near Kumta", text: "An old laterite fort with walls, bastions and wells. It is at its greenest during and after the rains." },
          { name: "Yana rocks", text: "Two tall black rock formations rising out of the forest of the Western Ghats, reached by a walk from the road." },
          { name: "The Kali river mouth, Karwar", text: "Where the Kali river meets the Arabian Sea, with Sadashivgad Fort above the bridge.", destination: "karwar" },
        ],
      },
      {
        heading: "How to see them",
        paragraphs: [
          "The temples and beaches are inside or close to the four towns, so a scooty or an auto is enough. Mirjan Fort and Yana are day trips by cab. The islands need a boat, and boats run only when the season and the sea allow.",
        ],
      },
    ],
    tips: [templeTip, boatTip, monsoonTip],
    destinations: ["gokarna", "murudeshwar", "karwar", "udupi"],
    shelves: ["guides", "cabs", "boating", "experiences"],
    faqs: [
      {
        question: "What are the main places to visit in Gokarna?",
        answer: "The Mahabaleshwar Temple, the Koti Teertha tank, and Gokarna, Kudle, Om, Half Moon and Paradise beaches.",
      },
      {
        question: "What is Murudeshwar famous for?",
        answer: "For the Murudeshwar Temple on Kanduka Hill, with the sea on three sides, and the large statue of Lord Shiva beside it. Netrani Island lies offshore.",
      },
      {
        question: "How do you reach St Mary's Island?",
        answer: "By boat from Malpe, near Udupi. Boats run only in season and do not run during the monsoon.",
      },
      {
        question: "Can I see Yana and Mirjan Fort from Gokarna?",
        answer: "Yes, both are day trips by road. A cab with a driver for the day is the simple way to see them.",
      },
    ],
    updated: "2026-11-12",
    seo: {
      title: "12 places to visit on the Karnataka coast: Gokarna to Udupi",
      description: "Sightseeing in coastal Karnataka: temples, Om and Kudle beaches, St Mary's Island, Mirjan Fort, the Yana rocks and more places to visit.",
      keywords: ["places to visit in coastal Karnataka", "coastal Karnataka sightseeing", "places to visit in Gokarna", "Murudeshwar Temple", "St Mary's Island", "Mirjan Fort", "Yana rocks", "Karwar tourist places"],
    },
  },
  {
    slug: "uttara-kannada-trip-plans",
    tag: "Uttara Kannada",
    detail: "Plans for 2, 4 and 6 days",
    title: "Uttara Kannada: three ways to plan the district",
    summary: "A weekend on the coast, four days of coast and rocks, or six days from the sea up into the Western Ghats.",
    lead: [
      "Uttara Kannada is a large district. Its western edge is coast: Karwar, Ankola, Gokarna, Kumta, Honnavar, Murudeshwar and Bhatkal. Behind the coast the land climbs into the forests of the Western Ghats, with rivers, waterfalls and towns such as Sirsi, Yellapur and Dandeli.",
      "Here are three plans, from short to long. Pick the one that fits your days.",
    ],
    image: "yana-rocks",
    plans: [
      {
        title: "Plan 1: the coast in a weekend (2 days)",
        stops: [
          {
            when: "Day 1",
            title: "Gokarna",
            body: "The temple town in the morning, then the headland trail from Kudle to Om Beach and the sunset at Kudle.",
            destination: "gokarna",
          },
          {
            when: "Day 2",
            title: "Mirjan Fort and Murudeshwar",
            body: "Stop at Mirjan Fort near Kumta on the way south. Spend the afternoon at the Murudeshwar Temple and the beach beside the temple hill.",
            destination: "murudeshwar",
          },
        ],
      },
      {
        title: "Plan 2: coast and rocks (4 days)",
        stops: [
          {
            when: "Day 1",
            title: "Karwar",
            body: "Rabindranath Tagore Beach, the warship museum and the Kali river mouth, with Sadashivgad Fort above the bridge.",
            destination: "karwar",
          },
          {
            when: "Day 2",
            title: "Gokarna",
            body: "Temples in the morning and the beach trail in the afternoon.",
            destination: "gokarna",
          },
          {
            when: "Day 3",
            title: "Yana",
            body: "A day trip by cab to the Yana rocks, with a walk through the forest to reach them.",
          },
          {
            when: "Day 4",
            title: "Honnavar and Murudeshwar",
            body: "Drive south past Honnavar, where the Sharavathi river reaches the sea, and end at Murudeshwar.",
            destination: "murudeshwar",
          },
        ],
      },
      {
        title: "Plan 3: from the sea to the Ghats (6 days)",
        note: "Our launch towns in this district are Karwar, Gokarna and Murudeshwar. The inland towns are not part of the launch yet, so arrange those nights yourself.",
        stops: [
          {
            when: "Days 1 to 3",
            title: "The coast",
            body: "Follow Plan 2 for Karwar, Gokarna and Murudeshwar.",
          },
          {
            when: "Day 4",
            title: "Sirsi",
            body: "Climb inland to Sirsi for the Marikamba Temple and Sahasralinga, where carvings sit on the rocks of a river bed.",
          },
          {
            when: "Day 5",
            title: "Yellapur's waterfalls",
            body: "Sathodi Falls and Magod Falls are both reached from Yellapur. They are fullest in and just after the monsoon, when the paths are also at their most slippery.",
          },
          {
            when: "Day 6",
            title: "Dandeli",
            body: "End on the Kali river at Dandeli, a forest town known for wildlife and river activities.",
          },
        ],
      },
    ],
    sections: [
      {
        heading: "When to go",
        paragraphs: [
          "The months after the monsoon are the easiest for the coast: the sea is calmer and boats run again. The monsoon itself is green and dramatic inland, but boats stop and many trails are closed or unsafe.",
        ],
      },
      {
        heading: "Getting there and around",
        paragraphs: [
          "The Konkan Railway and the NH 66 highway both follow the coast, so Karwar, Gokarna, Kumta, Honnavar and Murudeshwar are easy to link. The inland towns are reached by road from the coast.",
          "Use a scooty inside a town and a cab with a driver for the day trips and the hill roads.",
        ],
      },
    ],
    tips: [monsoonTip, templeTip, boatTip, licenceTip],
    destinations: ["karwar", "gokarna", "murudeshwar"],
    shelves: ["stays", "cabs", "rentals", "guides"],
    faqs: [
      {
        question: "What are the main tourist places in Uttara Kannada?",
        answer: "On the coast: Karwar, Gokarna, Honnavar and Murudeshwar. Inland: the Yana rocks, Sirsi, the waterfalls near Yellapur, and Dandeli on the Kali river.",
      },
      {
        question: "How many days are needed for Uttara Kannada?",
        answer: "Two days cover Gokarna and Murudeshwar. Four days add Karwar and Yana. Six days let you go inland to Sirsi, Yellapur and Dandeli.",
      },
      {
        question: "Is Uttara Kannada the same as North Canara?",
        answer: "Yes. North Canara, or North Kanara, is the older English name for Uttara Kannada district.",
      },
      {
        question: "Is Udupi in Uttara Kannada?",
        answer: "No. Udupi is in Udupi district, south of Uttara Kannada. Many coast trips still combine the two.",
      },
    ],
    updated: "2026-11-12",
    seo: {
      title: "Uttara Kannada tourist places: trip plans for 2, 4 and 6 days",
      description: "Three Uttara Kannada itineraries: a Gokarna and Murudeshwar weekend, four days with Karwar and Yana, and six days to Sirsi, Yellapur and Dandeli.",
      keywords: ["Uttara Kannada tourist places", "Uttara Kannada itinerary", "North Canara travel guide", "Uttara Kannada trip plan", "Yana rocks", "Dandeli", "Sirsi", "Honnavar"],
    },
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
