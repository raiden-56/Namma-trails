import Image from "next/image";
import { categoryShelves } from "@/config/categories";
import { destinations } from "@/content/destinations";
import { photo, type PhotoKey } from "@/content/photos";

/** A small photograph set inline with the headline text, sized by the type itself. */
function InlinePhoto({ name }: { name: PhotoKey }) {
  return (
    <span
      aria-hidden="true"
      className="relative mx-[0.1em] inline-block h-[0.78em] w-[1.45em] overflow-hidden rounded-full bg-sand align-[-0.05em]"
    >
      <Image src={photo(name).src} alt="" fill sizes="128px" className="object-cover" />
    </span>
  );
}

/**
 * One sentence that says what the product is, set large, with the things you can
 * book shown as photographs inside the line. The two figures come from config, so
 * they stay true as towns and categories are added.
 */
export function Manifesto() {
  const towns = destinations.map((d) => d.name);
  return (
    <section aria-labelledby="manifesto-title" className="py-16 lg:py-24">
      <div className="container-editorial grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
        <h2 id="manifesto-title" className="font-display text-display-xl lg:col-span-8">
          The{" "}
          <span className="whitespace-nowrap">
            stay <InlinePhoto name="homestay-veranda" />,
          </span>{" "}
          the{" "}
          <span className="whitespace-nowrap">
            boat ride <InlinePhoto name="boat-ride-sunset" />,
          </span>{" "}
          the{" "}
          <span className="whitespace-nowrap">
            scooty <InlinePhoto name="scooter" />
          </span>{" "}
          and the local{" "}
          <span className="whitespace-nowrap">
            guide <InlinePhoto name="gokarna-koti-teertha" />
          </span>{" "}
          — booked in one place, from partners we verify first.
        </h2>
        <dl className="grid grid-cols-2 gap-8 border-t border-line-strong pt-6 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
          <div className="flex flex-col gap-1">
            <dt className="font-display text-display-md tabular-nums">{destinations.length} towns to start</dt>
            <dd className="text-[0.9375rem] text-fg-muted">
              {towns.slice(0, -1).join(", ")} and {towns[towns.length - 1]}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-display text-display-md tabular-nums">{categoryShelves.length} kinds of service</dt>
            <dd className="text-[0.9375rem] text-fg-muted">From a room for the night to a multi-day package</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
