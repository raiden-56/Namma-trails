import { CloudRain, FileCheck2, MessageSquareQuote, Receipt, ShieldCheck, Undo2 } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";

const reasons = [
  {
    icon: ShieldCheck,
    title: "Partners are checked before they can take bookings",
    body: "Boat operators, rental businesses, drivers and guides submit identity, licence and insurance documents for review. Listings stay unpublished until checks are complete.",
  },
  {
    icon: Receipt,
    title: "The full price before you pay",
    body: "Every quote shows the base price, taxes and any fees. Deposits for rentals are shown separately.",
  },
  {
    icon: Undo2,
    title: "Cancellation rules up front",
    body: "Each service shows its own cancellation policy, and your refund amount is calculated from it before you confirm.",
  },
  {
    icon: FileCheck2,
    title: "Payments verified on our servers",
    body: "Bookings confirm only after the payment gateway confirms the payment to us directly.",
  },
  {
    icon: CloudRain,
    title: "A full refund when the partner cancels",
    body: "If a partner cancels a ride or an activity, including for rough weather, you get the whole amount back.",
  },
  {
    icon: MessageSquareQuote,
    title: "Reviews only from completed trips",
    body: "A review can be written only after a booking is completed, so every rating comes from a real trip.",
  },
];

export function WhyBook() {
  return (
    <section aria-labelledby="why-title" className="theme-ink py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-10 lg:gap-14">
        <div className="max-w-3xl">
          <p className="eyebrow">Why book with us</p>
          <h2 id="why-title" className="mt-3 font-display text-display-lg">
            Trust built into every booking, <em className="text-tomato">not added after.</em>
          </h2>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r, i) => (
            <li key={r.title} className="bg-surface">
              <Reveal delay={(i % 3) * 0.06} className="flex h-full flex-col gap-4 p-6 lg:p-8">
                <r.icon className="size-6 text-butter" aria-hidden="true" />
                <h3 className="font-display text-xl leading-snug">{r.title}</h3>
                <p className="text-[0.9375rem] leading-relaxed text-fg-muted">{r.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
        <p className="max-w-3xl text-sm text-fg-subtle">
          Partner approval means the documents a partner submitted were reviewed. It is not a certification of their legal
          compliance — always follow safety briefings and local regulations.
        </p>
      </div>
    </section>
  );
}
