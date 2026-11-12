import { ArrowUpRight } from "lucide-react";
import type { ServiceCategoryKey } from "@/lib/catalog";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { LiveInventory } from "../LiveInventory";
import { SectionHeading } from "../SectionHeading";

/**
 * Live listings, one tab per kind of service. Each tab reads the search API when it
 * is opened and shows a designed empty state when no verified partner has published
 * anything — never sample listings.
 */
const shelves: Array<{
  id: string;
  label: string;
  categories: ServiceCategoryKey[];
  links: Array<{ href: string; label: string }>;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    id: "experiences",
    label: "Experiences",
    categories: ["adventure", "experience", "sightseeing", "water_sports"],
    links: [{ href: "/experiences", label: "All experiences" }],
    emptyTitle: "No verified experiences yet",
    emptyDescription:
      "We are opening Gokarna, Murudeshwar, Karwar and Udupi to activity operators. Experiences appear here only after the operator is verified and the listing is approved.",
  },
  {
    id: "stays",
    label: "Stays",
    categories: ["stay"],
    links: [{ href: "/stays", label: "All stays" }],
    emptyTitle: "No verified stays yet",
    emptyDescription: "Hotels, resorts and homestays become bookable here only after their property documents are verified.",
  },
  {
    id: "boating",
    label: "Boat rides",
    categories: ["boating"],
    links: [{ href: "/boating", label: "All boat rides" }],
    emptyTitle: "No verified boat rides yet",
    emptyDescription: "Boat rides are listed only after operators complete licence, registration and safety-document checks.",
  },
  {
    id: "transport",
    label: "Rentals and cabs",
    categories: ["two_wheeler_rental", "car_rental", "taxi", "auto"],
    links: [
      { href: "/rentals", label: "All rentals" },
      { href: "/cabs", label: "All cabs and transport" },
    ],
    emptyTitle: "No verified rentals or cabs yet",
    emptyDescription:
      "Scooty, bike and car rental businesses and taxi operators appear here once vehicle registration and insurance are verified.",
  },
];

export function LiveShelves() {
  return (
    <section aria-labelledby="live-title" className="bg-surface-sunken py-16 lg:py-24">
      <div className="container-editorial flex flex-col gap-8">
        <SectionHeading
          eyebrow="Live listings"
          title={<span id="live-title">What you can book now</span>}
          intro="Every card here is a published listing from a verified partner, read live from the marketplace."
          action={
            <Button href="/explore" variant="secondary" trailingIcon={<ArrowUpRight className="size-4" />}>
              Search everything
            </Button>
          }
        />
        <Tabs
          label="Kind of service"
          items={shelves.map((shelf) => ({
            id: shelf.id,
            label: shelf.label,
            content: (
              <div className="flex flex-col gap-6">
                <LiveInventory categories={shelf.categories} emptyTitle={shelf.emptyTitle} emptyDescription={shelf.emptyDescription} />
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  {shelf.links.map((link) => (
                    <Button key={link.href} href={link.href} variant="link" trailingIcon={<ArrowUpRight className="size-4" />}>
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            ),
          }))}
        />
      </div>
    </section>
  );
}
