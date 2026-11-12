import type { Metadata } from "next";
import { Block } from "./Block";
import { Wordmark } from "@/components/layout/Wordmark";
import { MediaFrame } from "@/components/media/MediaFrame";
import type { SceneName } from "@/components/media/PlaceholderScene";
import { TextReveal } from "@/components/motion/TextReveal";
import { InteractiveShowcase } from "./InteractiveShowcase";
import { StaticShowcase } from "./StaticShowcase";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const palette: Array<{ name: string; token: string; hex: string; note: string; dark?: boolean }> = [
  { name: "Cream", token: "--color-cream", hex: "#F8F2E8", note: "Page surface" },
  { name: "Ivory", token: "--color-ivory", hex: "#FFFDF8", note: "Raised surface" },
  { name: "Ink", token: "--color-ink", hex: "#191713", note: "Text · 16.2:1 on cream", dark: true },
  { name: "Tomato", token: "--color-tomato", hex: "#E65B3F", note: "Accent · large text/graphics only (3.2:1)" },
  { name: "Burnt", token: "--color-burnt", hex: "#B94A2E", note: "Small accent text · 4.6:1 on cream", dark: true },
  { name: "Sage", token: "--color-sage", hex: "#A7AE91", note: "Calm sections" },
  { name: "Sand", token: "--color-sand", hex: "#D9C9AF", note: "Media backdrop" },
  { name: "Butter", token: "--color-butter", hex: "#EBCB79", note: "Highlights, warning tint" },
  { name: "Muted", token: "--color-muted", hex: "#5F5B54", note: "Secondary text · 6.1:1", dark: true },
  { name: "Warm grey", token: "--color-grey-warm", hex: "#77736C", note: "Decorative only (4.25:1)", dark: true },
  { name: "Sea", token: "--color-sea", hex: "#3B6670", note: "Info · 5.7:1", dark: true },
  { name: "Sage deep", token: "--color-sage-deep", hex: "#4E6B3A", note: "Success · 5.4:1", dark: true },
];

const typeScale = [
  ["display-2xl", "text-display-2xl font-display", "Coast"],
  ["display-xl", "text-display-xl font-display", "Gokarna"],
  ["display-lg", "text-display-lg font-display", "Boats at first light"],
  ["display-md", "text-display-md font-display", "Plan the whole trip"],
  ["display-sm", "text-display-sm font-display", "Places to stay"],
  ["lead", "text-lead", "Lead paragraph for introductions and editorial standfirsts."],
  ["base", "text-base", "Body text for descriptions, policies and booking details."],
  ["sm", "text-sm", "Supporting text, hints and metadata."],
] as const;

const scenes: SceneName[] = ["coast", "backwater", "temple", "hills", "road", "forest"];

export default function DesignSystemPage() {
  return (
    <main id="main" className="container-editorial py-12">
      <header className="flex flex-col gap-4 pb-8">
        <Wordmark />
        <TextReveal as="h1" text="Design system" className="font-display text-display-xl" />
        <p className="max-w-3xl text-lead text-fg-muted">
          Phase 1 review surface: tokens and every component state. Values shown in component demos are illustrative and labelled — they are not
          marketplace data.
        </p>
      </header>

      <Block id="colour" title="Colour" note="Raw palette tokens. Semantic tokens (surface, fg, accent, line, success…) map onto these and re-theme inside .theme-ink sections.">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {palette.map((c) => (
            <li key={c.token} className="overflow-hidden rounded-lg border border-line bg-surface-raised">
              <div className="flex h-24 items-end p-3" style={{ backgroundColor: c.hex }}>
                <span className={c.dark ? "text-sm font-semibold text-cream" : "text-sm font-semibold text-ink"}>Aa</span>
              </div>
              <div className="flex flex-col gap-0.5 p-3 text-xs">
                <span className="text-sm font-semibold">{c.name}</span>
                <code className="text-fg-muted">{c.hex}</code>
                <span className="text-fg-muted">{c.note}</span>
              </div>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="type" title="Typography" note="Playfair Display for editorial headings, Archivo for interface and body, Caveat only for rare handwritten accents. Fluid sizes clamp between 360px and 1440px viewports.">
        <div className="flex flex-col divide-y divide-line">
          {typeScale.map(([name, cls, sample]) => (
            <div key={name} className="grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:items-baseline">
              <code className="text-xs text-fg-muted">{name}</code>
              <p className={cls}>{sample}</p>
            </div>
          ))}
          <div className="grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:items-baseline">
            <code className="text-xs text-fg-muted">script</code>
            <p className="font-script text-3xl text-accent-text">See you on the coast</p>
          </div>
        </div>
      </Block>

      <Block id="spacing" title="Spacing, radii & elevation" note="4px base spacing (Tailwind scale). Radii xs→2xl. Two warm shadows: card and lift.">
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
            <div key={n} className="flex flex-col items-center gap-2">
              <div className="bg-accent" style={{ width: `${n * 4}px`, height: `${n * 4}px` }} />
              <code className="text-xs text-fg-muted">{n * 4}px</code>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"].map((r) => (
            <div key={r} className={`flex size-24 items-end bg-surface-raised p-2 shadow-card ${r}`}>
              <code className="text-xs text-fg-muted">{r}</code>
            </div>
          ))}
          <div className="flex size-24 items-end rounded-lg bg-surface-raised p-2 shadow-lift">
            <code className="text-xs text-fg-muted">shadow-lift</code>
          </div>
        </div>
      </Block>

      <Block id="media" title="Media placeholders" note="No licensed photography ships with the repo. MediaFrame renders these art-directed scenes until real images are supplied.">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {scenes.map((s) => (
            <li key={s}>
              <MediaFrame alt={`${s} scene`} scene={s} aspect="aspect-[4/5]" className="rounded-lg" />
              <code className="mt-1 block text-xs text-fg-muted">{s}</code>
            </li>
          ))}
        </ul>
      </Block>

      <StaticShowcase />
      <InteractiveShowcase />

      <section aria-labelledby="ink" className="theme-ink -mx-4 mt-12 rounded-2xl px-6 py-12 sm:mx-0">
        <h2 id="ink" className="font-display text-display-sm">
          Dark editorial section
        </h2>
        <p className="mt-2 max-w-2xl text-fg-muted">
          <code>.theme-ink</code> re-maps semantic tokens, so every component adapts without variants. Accent text switches to tomato (5.0:1 on ink).
        </p>
        <p className="mt-4 font-semibold text-accent-text">Accent text on ink</p>
      </section>
    </main>
  );
}
