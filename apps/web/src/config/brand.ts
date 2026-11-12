/**
 * Brand configuration. Everything brand-specific (name, voice, contact, socials)
 * is read from here so the marketplace can be renamed without touching components.
 * Colours and type live as design tokens in src/styles/globals.css.
 */
export const brand = {
  name: "Namma Trails",
  shortName: "Namma",
  /** Two-part wordmark used by <Wordmark/> — the second part is set in the accent. */
  wordmark: { primary: "Namma", secondary: "Trails" },
  tagline: "Plan and book your Karnataka coast trip in one place.",
  /** Short handwritten sign-off, set in the script face. Use sparingly. */
  signature: "Namma coast, your pace.",
  description:
    "Stays, boat rides, rentals, cabs, local guides and experiences from verified local partners across coastal Karnataka.",
  locale: "en-IN",
  region: "Karnataka, India",
  contact: {
    // Placeholders until the operating entity's support channels are set up.
    supportEmail: "support@example.com",
    partnerEmail: "partners@example.com",
  },
  social: [] as ReadonlyArray<{ label: string; href: string }>,
  legal: {
    entityName: "Operating entity to be confirmed",
  },
} as const;

export type Brand = typeof brand;
