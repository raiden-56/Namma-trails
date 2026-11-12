import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "../SectionHeading";

/**
 * Everything the product does today, grouped by who uses it and set as a ledger
 * rather than a card grid. Each line names something that is built and reachable in
 * the app; planned work (document upload, partner-made listings, a live payment
 * gateway) is deliberately left out until it ships.
 */
interface Group {
  id: string;
  title: string;
  lead: string;
  cta?: { label: string; href: string };
  features: Array<{ name: string; detail: string }>;
}

const groups: Group[] = [
  {
    id: "features-traveller",
    title: "For travellers",
    lead: "Find something, see what it costs, book it and follow it to the day.",
    cta: { label: "Start exploring", href: "/explore" },
    features: [
      { name: "One search for everything", detail: "Town, kind of service, dates and guests in a single search bar." },
      { name: "Filters and sorting", detail: "Narrow by price and traveller rating. Sort by recommended, price or rating." },
      { name: "Destination guides", detail: "An overview, places to see, travel tips and common questions for each town." },
      { name: "Detailed listing pages", detail: "Highlights, what is included, safety notes, where to go, the partner and the cancellation policy." },
      { name: "Booking that fits the service", detail: "Seats on a departure, rooms by the night, rentals by pickup and return time, cabs by route, guides by the day." },
      { name: "The full price first", detail: "Base price, taxes, fees and deposits line by line, with coupon codes applied before you book." },
      { name: "Instant or request to book", detail: "Some listings confirm at once. Others wait for the partner, and you pay only after they accept." },
      { name: "Held while you pay", detail: "Checkout keeps your seats or rooms for a short time and shows the countdown." },
      { name: "My Trips", detail: "Upcoming, past and cancelled bookings, each with its status and a timeline of what happened." },
      { name: "Cancellation with a clear refund", detail: "See the refund the policy gives you before you confirm a cancellation." },
      { name: "Reviews from real trips", detail: "Only travellers with a completed booking can rate and review." },
      { name: "Two ways to sign in", detail: "A one-time code sent to your mobile number, or email and password." },
    ],
  },
  {
    id: "features-partner",
    title: "For local partners",
    lead: "A portal for the people who run the stays, boats, vehicles and tours.",
    cta: { label: "Become a partner", href: "/partner/join" },
    features: [
      { name: "Register yourself", detail: "A seven-step form: account, mobile code, business, services, location, documents, submit." },
      { name: "Application status", detail: "See where your application stands, its history and the documents your services require." },
      { name: "Dashboard figures", detail: "Bookings today, upcoming bookings, requests waiting, earnings this month, listing views and rating." },
      { name: "Your listings", detail: "Each listing with its price, views, bookings and whether it confirms instantly." },
      { name: "Booking requests", detail: "Accept or decline request-to-book bookings from the Requests tab." },
      { name: "On the day", detail: "Mark a booking started or completed, or cancel it with a reason." },
      { name: "Finance", detail: "Gross value, commission and tax, refund adjustments, net earnings, pending settlement and payouts." },
      { name: "Staff roles", detail: "Staff sign in with their own role. A front-desk account can manage bookings but cannot see finance." },
    ],
  },
  {
    id: "features-team",
    title: "For the marketplace team",
    lead: "The private console our own staff use to keep every listing honest.",
    features: [
      { name: "Marketplace overview", detail: "Live counts of users, partners, applications, destinations, listings, bookings, revenue and refunds." },
      { name: "Partner verification", detail: "A review queue and a page per application to check documents, then approve, ask for information or reject." },
      { name: "Destination launch control", detail: "Take a town live or offline, see its partners and live listings, and feature it on the homepage." },
      { name: "Listing moderation", detail: "Publish, approve, pause, request changes or reject each listing." },
      { name: "User directory", detail: "Search people by name, email or phone and filter by role." },
      { name: "Booking oversight", detail: "Every booking across all partners with its status." },
      { name: "Finance", detail: "Booking value, commission, taxes, fees, refunds and partner payouts, split by category." },
      { name: "Support desk", detail: "Tickets linked to bookings, with urgency, escalation, safety-incident details and internal notes." },
    ],
  },
];

export function FeatureLedger() {
  return (
    <section aria-labelledby="features-title" className="py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-10 lg:gap-14">
        <SectionHeading
          eyebrow="What is inside"
          title={<span id="features-title">Everything the marketplace does today</span>}
          intro="Three sets of screens share one set of rules: the traveller site, the partner portal and the team console."
        />
        <div className="flex flex-col">
          {groups.map((group, i) => (
            <Reveal
              as="article"
              key={group.id}
              className="grid gap-8 border-t border-line-strong py-10 last:pb-0 lg:grid-cols-12 lg:gap-16 lg:py-14"
            >
              <header className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-4 lg:self-start">
                <p aria-hidden="true" className="font-display text-display-sm tabular-nums text-accent-text">
                  0{i + 1}
                </p>
                <h3 id={group.id} className="font-display text-display-md">
                  {group.title}
                </h3>
                <p className="max-w-sm text-fg-muted">{group.lead}</p>
                {group.cta ? (
                  <div className="pt-1">
                    <Button href={group.cta.href} variant="link" trailingIcon={<ArrowUpRight className="size-4" />}>
                      {group.cta.label}
                    </Button>
                  </div>
                ) : null}
              </header>
              <dl aria-labelledby={group.id} className="grid gap-x-12 sm:grid-cols-2 lg:col-span-8">
                {group.features.map((feature) => (
                  <div key={feature.name} className="flex flex-col gap-1 border-b border-line py-4">
                    <dt className="font-semibold">{feature.name}</dt>
                    <dd className="text-[0.9375rem] leading-relaxed text-fg-muted">{feature.detail}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
