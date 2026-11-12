import { ArrowUpRight, Check } from "lucide-react";
import { photo } from "@/content/photos";
import { MediaFrame } from "@/components/media/MediaFrame";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { Button } from "@/components/ui/Button";

const points = [
  "Register yourself online — no phone calls or paperwork drop-offs",
  "Offer stays, boats, vehicles, guiding or activities under one account",
  "Answer requests and see bookings, commission and payouts in your portal",
];

export function PartnerCta() {
  const boatman = photo("boat-ride-sunset");
  return (
    <section aria-labelledby="partner-cta-title" className="py-16 lg:py-24">
      <div className="container-editorial">
        <div className="grid overflow-hidden rounded-2xl bg-accent text-ink lg:grid-cols-2">
          <div className="flex flex-col gap-6 p-8 sm:p-12 lg:p-16">
            <p className="text-sm font-semibold">For local businesses</p>
            <h2 id="partner-cta-title" className="font-display text-display-lg">
              Run a boat, a homestay or a rental? Bring it online.
            </h2>
            <ul className="flex flex-col gap-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{p}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button href="/partner/register" variant="strong" size="lg" trailingIcon={<ArrowUpRight className="size-5" />}>
                Register your business
              </Button>
              <Button href="/partner/join" variant="ghost" size="lg" className="hover:bg-ink/10">
                How partnering works
              </Button>
            </div>
          </div>
          <ParallaxImage className="min-h-80 lg:min-h-full">
            <MediaFrame src={boatman.src} alt={boatman.alt} className="absolute inset-0" />
          </ParallaxImage>
        </div>
      </div>
    </section>
  );
}
