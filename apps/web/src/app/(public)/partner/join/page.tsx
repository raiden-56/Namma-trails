import type { Metadata } from "next";
import { ArrowUpRight, CalendarCheck, FileCheck2, ShieldCheck, Store, Users, Wallet } from "lucide-react";
import { categoryShelves } from "@/config/categories";
import { MediaFrame } from "@/components/media/MediaFrame";
import { Reveal } from "@/components/motion/Reveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Become a Partner",
  description: "List your boat rides, stays, rentals, cabs, guiding or experiences. Register online, get verified and manage bookings from your partner portal.",
  alternates: { canonical: "/partner/join" },
};

const journey = [
  { icon: Store, title: "Register online", body: "Create one account for your business, verify your mobile number and choose every service category you offer." },
  { icon: FileCheck2, title: "Upload documents", body: "Upload the documents your categories require — registration, licences, insurance. They're stored privately." },
  { icon: ShieldCheck, title: "Get verified", body: "Our verification team reviews your application. If something is missing, you'll see exactly what and can fix it." },
  { icon: CalendarCheck, title: "Publish and take bookings", body: "Create listings with your prices, availability and policies. They go live once approved." },
];

const portal = [
  { icon: CalendarCheck, title: "Bookings & availability", body: "Slots, rooms and vehicles in one calendar. Accept or decline requests, block dates." },
  { icon: Users, title: "Your team", body: "Add managers, reception staff, boat crew and drivers with role-based access." },
  { icon: Wallet, title: "Earnings & payouts", body: "Gross value, commission, taxes and payouts shown line by line with downloadable statements." },
];

export default function PartnerJoinPage() {
  return (
    <>
      <section aria-labelledby="join-title" className="container-editorial grid gap-10 py-12 lg:grid-cols-12 lg:py-16">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <p className="eyebrow">For local tourism businesses</p>
          <TextReveal id="join-title" as="h1" text="Bring your business to travellers planning the coast." className="font-display text-display-xl" />
          <p className="max-w-xl text-lead text-fg-muted">
            Boat operators, homestays, hotels, rental businesses, drivers, guides and activity operators register themselves, get verified and manage
            everything from one portal.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/partner/register" size="lg" trailingIcon={<ArrowUpRight className="size-5" />}>
              Register your business
            </Button>
            <Button href="/sign-in?as=partner" size="lg" variant="secondary">
              Partner sign in
            </Button>
          </div>
        </div>
        <MediaFrame alt="A homestay host welcoming guests" scene="hills" aspect="aspect-[4/5]" className="rounded-2xl lg:col-span-5" />
      </section>

      <section aria-labelledby="journey-title" className="theme-ink py-14 lg:py-20">
        <div className="container-editorial flex flex-col gap-12">
          <SectionHeading eyebrow="How it works" title={<span id="journey-title">From registration to your first booking</span>} />
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {journey.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.07} className="flex flex-col gap-4 border-t border-line-strong pt-6">
                <span className="font-display text-display-sm text-tomato">0{i + 1}</span>
                <s.icon className="size-6 text-butter" aria-hidden="true" />
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="text-fg-muted">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="who-title" className="container-editorial flex flex-col gap-10 py-14 lg:py-20">
        <SectionHeading eyebrow="Who can join" title={<span id="who-title">One account, any mix of services</span>} intro="A homestay that also rents scooties, or a boat operator who also guides — list it all under one business." />
        <ul className="flex flex-wrap gap-3">
          {categoryShelves.map((s) => (
            <li key={s.slug} className="rounded-full border border-line-strong px-4 py-2 font-semibold">
              {s.label} <span className="font-normal text-fg-muted">· {s.blurb}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="portal-title" className="bg-surface-sunken py-14 lg:py-20">
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading eyebrow="Partner portal" title={<span id="portal-title">Run it all from one place</span>} />
          <ul className="grid gap-5 md:grid-cols-3">
            {portal.map((p) => (
              <li key={p.title} className="flex flex-col gap-3 rounded-xl bg-surface-raised p-6 shadow-card">
                <p.icon className="size-6 text-accent-text" aria-hidden="true" />
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-fg-muted">{p.body}</p>
              </li>
            ))}
          </ul>
          <p className="max-w-3xl text-sm text-fg-muted">
            Commission and any subscription fees are configured per category and shown to you before you publish. Approval confirms that we reviewed
            your submitted documents; it does not certify your legal compliance, which remains your responsibility.
          </p>
        </div>
      </section>
    </>
  );
}
