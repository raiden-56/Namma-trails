import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/config/brand";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import { SectionHeading } from "../SectionHeading";

/**
 * The flow of the marketplace as a trail with five stops, once for each group that
 * takes part in a booking. Every step describes a screen that exists in the app;
 * `where` names that screen. No listings, prices or providers are shown here.
 */
interface Step {
  title: string;
  body: string;
  /** The screen where this step happens. */
  where: string;
  href?: string;
}

const travellerSteps: Step[] = [
  {
    title: "Search",
    body: "Choose a town, a kind of service, your dates and your group size. Narrow the results by price and rating, or sort them.",
    where: "Explore",
    href: "/explore",
  },
  {
    title: "See the full price",
    body: "Pick a departure, a room, a vehicle or a route. The quote lists the base price, taxes, fees, deposits and any coupon before you commit.",
    where: "Listing page",
  },
  {
    title: "Book or request",
    body: "Many listings confirm at once. Where the partner confirms first, nothing is charged until they accept your request.",
    where: "Booking panel",
  },
  {
    title: "Pay",
    body: "Your seats, rooms or vehicle are held for a short time while you pay. The booking confirms only after the payment is verified on our servers.",
    where: "Checkout",
  },
  {
    title: "Follow your trip",
    body: "Each booking shows its status and a timeline. Cancel from there and see your refund under the policy first. Review once the trip is done.",
    where: "My Trips",
    href: "/trips",
  },
];

const partnerSteps: Step[] = [
  {
    title: "Register online",
    body: "Seven short steps: your account, a code sent to your mobile, business details, the services you offer, your location, the document checklist, then submit.",
    where: "Partner registration",
    href: "/partner/register",
  },
  {
    title: "Get verified",
    body: "Our verification team checks your documents against the rules for your service categories. You can follow the status and its history.",
    where: "Partner dashboard",
  },
  {
    title: "Listings go live",
    body: "Each listing is reviewed before it is published, so travellers only ever see listings from approved partners.",
    where: "Listings",
  },
  {
    title: "Handle bookings",
    body: "Accept or decline requests, see who is coming, mark a service started or completed, or cancel with a reason.",
    where: "Bookings",
  },
  {
    title: "See what you earn",
    body: "Gross value, commission and tax, refund adjustments, net earnings, pending settlement and payouts, booking by booking.",
    where: "Finance",
  },
];

const teamSteps: Step[] = [
  {
    title: "Check every partner",
    body: "Each application is reviewed against the documents its categories require. The team can approve it, ask for more information or reject it.",
    where: "Provider applications",
  },
  {
    title: "Review every listing",
    body: "A listing is published only after a check. It can also be paused, sent back for changes or rejected.",
    where: "Listings",
  },
  {
    title: "Open towns when ready",
    body: "Each destination shows its partner applications, approved partners and live listings, and is taken live or offline from one place.",
    where: "Destinations",
  },
  {
    title: "Watch bookings and money",
    body: "Every booking, refund, commission line and partner payout across the marketplace, with a split by category.",
    where: "Bookings and Finance",
  },
  {
    title: "Look after support",
    body: "Tickets are linked to the booking they are about. Safety incidents are escalated and carry internal notes.",
    where: "Support",
  },
];

function Trail({ steps, footer }: { steps: Step[]; footer: ReactNode }) {
  return (
    <div className="flex flex-col gap-10 pt-4 lg:gap-12 lg:pt-8">
      <div className="relative">
        {/* ≥ lg: the route runs left to right above the steps; each stop sits on it. */}
        <Reveal className="trail-line pointer-events-none absolute left-5 top-0 hidden h-24 w-full text-burnt lg:block">
          <svg viewBox="0 0 1000 96" preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden="true">
            <path
              d="M0 28 C 70 28, 130 68, 200 68 S 330 28, 400 28 S 530 68, 600 68 S 730 28, 800 28 S 930 60, 1000 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="0.1 10"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </Reveal>

        {/* < lg: the same route runs down the left edge. */}
        <ol className="relative flex flex-col gap-8 before:absolute before:bottom-5 before:left-5 before:top-5 before:-translate-x-1/2 before:border-l-[3px] before:border-dotted before:border-burnt/70 lg:grid lg:grid-cols-5 lg:gap-0 lg:before:hidden">
          {steps.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 0.08} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 lg:block lg:pr-8 lg:pt-28">
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full bg-ink font-display text-lg leading-none text-cream ring-4 ring-surface lg:absolute lg:left-0",
                  i % 2 === 0 ? "lg:top-2" : "lg:top-12",
                )}
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold leading-snug">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-fg-muted">{step.body}</p>
                {step.href ? (
                  <Link
                    href={step.href}
                    className="inline-flex w-fit items-center gap-1 text-[0.8125rem] font-semibold text-accent-text underline-offset-4 hover:underline"
                  >
                    {step.where}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="text-[0.8125rem] font-semibold text-fg-muted">{step.where}</p>
                )}
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-4 border-t border-line-strong pt-6 sm:flex-row sm:items-center sm:justify-between">{footer}</div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="theme-sage py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-10">
        <SectionHeading
          eyebrow="How it works"
          title={<span id="how-title">How {brand.name} works, step by step</span>}
          intro="Three groups make every booking happen: the traveller, the local partner and our own team. Choose one to follow its trail."
        />
        <Tabs
          label="Whose steps to show"
          variant="pill"
          listClassName="w-fit max-w-full"
          items={[
            {
              id: "traveller",
              label: "Travellers",
              content: (
                <Trail
                  steps={travellerSteps}
                  footer={
                    <>
                      <p className="max-w-xl text-[0.9375rem] text-fg-muted">
                        The steps are the same for a homestay, a boat seat, a scooty, a cab or a guide. Only the choices change.
                      </p>
                      <Button href="/explore" trailingIcon={<ArrowUpRight className="size-4" />}>
                        Start planning
                      </Button>
                    </>
                  }
                />
              ),
            },
            {
              id: "partner",
              label: "Local partners",
              content: (
                <Trail
                  steps={partnerSteps}
                  footer={
                    <>
                      <p className="max-w-xl text-[0.9375rem] text-fg-muted">
                        One account covers any mix of services, such as a homestay that also rents scooties.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button href="/partner/register" trailingIcon={<ArrowUpRight className="size-4" />}>
                          Register your business
                        </Button>
                        <Button href="/partner/join" variant="secondary">
                          For partners
                        </Button>
                      </div>
                    </>
                  }
                />
              ),
            },
            {
              id: "team",
              label: "Our team",
              content: (
                <Trail
                  steps={teamSteps}
                  footer={
                    <p className="max-w-3xl text-[0.9375rem] text-fg-muted">
                      The team console is private. Operations, verification, finance and support staff each sign in with their own
                      role and see only their own area.
                    </p>
                  }
                />
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
