import Link from "next/link";
import { brand } from "@/config/brand";
import { categoryShelves } from "@/config/categories";
import { destinations } from "@/content/destinations";
import { Wordmark } from "./Wordmark";

const columns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  { title: "Destinations", links: destinations.map((d) => ({ label: d.name, href: `/destinations/${d.slug}` })) },
  { title: "Book", links: categoryShelves.map((s) => ({ label: s.label, href: s.href })) },
  {
    title: "Partners",
    links: [
      { label: "Become a Partner", href: "/partner/join" },
      { label: "Register your business", href: "/partner/register" },
      { label: "Partner sign in", href: "/sign-in?as=partner" },
    ],
  },
  {
    title: "Traveller",
    links: [
      { label: "My Trips", href: "/trips" },
      { label: "Blog", href: "/blog" },
      { label: "User manual", href: "/user-manual" },
      { label: "Saved", href: "/saved" },
      { label: "Account", href: "/account" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="theme-ink">
      <div className="container-editorial py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="flex flex-col gap-5">
            <Wordmark className="text-4xl" />
            <p className="max-w-sm text-fg-muted">{brand.description}</p>
            <p className="font-script text-2xl text-butter">{brand.signature}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="mb-4 text-sm font-semibold text-fg-subtle">{col.title}</h2>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-[0.9375rem] text-fg/90 underline-offset-4 hover:text-fg hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 text-sm text-fg-subtle md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.legal.entityName}. Partners are independently verified against submitted documents;
            approval is not a certification of legal compliance.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Support: <a className="underline underline-offset-4 hover:text-fg" href={`mailto:${brand.contact.supportEmail}`}>{brand.contact.supportEmail}</a>
            </span>
            <Link href="/photo-credits" className="underline underline-offset-4 hover:text-fg">
              Photo credits
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
