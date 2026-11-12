# 08 · Design system

Live reference: **`/design-system`** (noindex) renders every token and component state. Tokens: [`apps/web/src/styles/globals.css`](../apps/web/src/styles/globals.css). Brand: [`apps/web/src/config/brand.ts`](../apps/web/src/config/brand.ts).

## Direction

The visual reference is Kolibrie Studio's *principles*, adapted rather than copied: editorial typography at very large sizes, warm cream canvases with tomato accents, layered image compositions, pinned and stacked storytelling sections, slow confident motion, and transitions between light and dark "ink" sections. None of its layouts, copy, assets or branding is reused. The Karnataka identity comes from the coast itself: sunsets, laterite, paddy greens and sea teal.

The feel should be premium, editorial, warm and trustworthy, and never a generic SaaS template: no purple/blue gradients, glassmorphism, or emoji labels.

### Four experiences, one token set

| Experience | Density | Character |
|---|---|---|
| Public site | airy | Cinematic: display serif, full-bleed media, pinned stack, parallax on desktop only |
| Traveller app (`/trips`, `/saved`, `/account`) | comfortable | Friendly and task-first; mobile bottom nav; minimal motion |
| Provider portal (`/partner`) | comfortable | Practical: sidebar, KPI tiles, verification banner, large touch targets for phone use on site |
| Admin (`/admin`) | compact | Information-dense: smaller type, tight tables, persistent filters |

## Tokens

**Palette (raw):** cream `#F8F2E8`, ivory `#FFFDF8`, ink `#191713`, tomato `#E65B3F`, burnt `#B94A2E`, sage `#A7AE91`, sand `#D9C9AF`, butter `#EBCB79`, warm grey `#77736C`. Additions: `sea #3B6670` / `sea-light #9FB8B6` for water in illustrations; `sage-deep`, `butter-deep` for accessible text on those tints; `muted #5F5B54`.

**Semantic tokens** (components use only these): `surface`, `surface-raised`, `surface-sunken`, `fg`, `fg-muted`, `fg-subtle`, `line`, `line-strong`, `accent`, `accent-fg`, `accent-text`, `success`, `warning`, `danger`, `info`. Section themes `.theme-ink` (dark editorial) and `.theme-sage` re-map them, so components re-theme without changes.

**Contrast decisions (WCAG 2.2 AA):**

| Pairing | Ratio | Use |
|---|---|---|
| ink on cream | 16.2:1 | body text |
| tomato on cream | 3.2:1 | **large text and graphics only** |
| ink on tomato | 5.0:1 | primary button label |
| ivory on burnt | 5.1:1 | primary button hover |
| burnt on cream | 4.6:1 | small accent text (`accent-text`) |
| warm grey `#77736C` | 4.25:1 | decorative only; muted text uses `#5F5B54` (6.1:1) |
| tomato on ink | 5.0:1 | accent text inside `.theme-ink` |

**Typography:** Archivo (UI and body), Playfair Display (editorial headings), Caveat (rare handwritten accents, at most one per view), all through `next/font` (self-hosted, no layout shift). Fluid display scale `display-sm … display-2xl` using `clamp()` with tight leading and negative tracking; body copy stays 16–18 px with a 65–75ch measure.

**Other tokens:** radii `xs…2xl` (cards `lg`/`xl`, the hero frame `2xl`); shadows `card` and `lift` (warm, low-spread); easings `editorial` `cubic-bezier(.22,1,.36,1)` and `swift`; durations 160/280/700 ms; breakpoints are Tailwind's plus `xs` (26rem) and `3xl` (112rem).

Brand name, wordmark, tagline and contact details come from `config/brand.ts`, and the colours from the token layer, so a rebrand needs no business-logic changes.

## Components (`src/components/ui`)

Button (primary, secondary, ghost, link, danger; sizes; loading; `href` support) · PendingAction (visibly disabled, with a reason, for not-yet-wired actions) · IconButton · Field (label, hint and error wired via aria) · Input / Textarea · Select (our own dropdown: a button that opens a list, not the browser's `<select>`; options can carry a detail such as a price) · DatePicker (our own month calendar, not the browser's date input; `min`/`max`, optional Clear, shades a from/to range) · Popover (`useAnchoredPanel` + `PopoverPanel`: the floating surface both of them use, shown in the browser's top layer so it is never cut off inside a sheet or a sticky panel) · Checkbox / Radio / Switch · SearchBar (segmented on desktop, bottom sheet on mobile, submits to `/explore`) · DateField / DateRangeField / TimeSlotPicker / GuestStepper · Card / DestinationCard / ServiceCard · Badge / StatusChip (provider, listing, booking, document and destination statuses mapped to tones) · Tabs (roving tabindex) · Dialog / Modal / Sheet (native `<dialog>`: focus trap, Esc, scroll lock) · Toast · Table (stacks into cards on mobile) · Skeleton, EmptyState, ErrorState, Spinner · Breadcrumbs, Pagination · Avatar, KpiTile, Stepper. The public layout also has BackToTop (`components/layout`), a round button that appears after scrolling.

Composite sections live in `components/sections` (home sections, CategoryLanding, Explore, LiveInventory). They take data through hooks or props and contain no business rules.

## Imagery

No licensed photography exists yet, so nothing is hotlinked or faked. `MediaFrame` renders a real image when given `src`; otherwise it shows a `PlaceholderScene`, one of six art-directed SVG coastal compositions in palette tones, each labelled "Photo placeholder — …". Drop-in instructions: `apps/web/public/images/README.md`. Replace these with commissioned or licensed Karnataka photography before launch (risk R-12).

## Motion rules

| Tool | Used for |
|---|---|
| CSS (`word-rise` text reveal) | headline reveals with no layout shift and no JavaScript dependency |
| CSS + IntersectionObserver | `Reveal` on scroll and the homepage trail line: content is rendered visible and only hidden-then-revealed after hydration, so nothing depends on JavaScript or breaks under reduced motion |
| Motion (`motion/react`) | available for small UI transitions |
| GSAP + ScrollTrigger (lazy-loaded) | `ParallaxImage`, the `PinnedStack` destination card stack |
| Lenis | smooth scrolling on **public routes, desktop, fine pointer only** |

Rich motion runs only with `(pointer: fine)`, a desktop width, and no `prefers-reduced-motion: reduce`. Otherwise components fall back to static layouts: the pinned stack becomes a scroll-snap rail on mobile. Animation never delays content (everything is in the DOM and visible without JavaScript), never traps scrolling, and is never used in booking, portal or admin flows beyond 160–280 ms state transitions.

## Accessibility checklist (enforced in review, automated with axe in Phase 9)

Visible focus rings on every interactive element; skip link; one `h1` per page; form errors announced with `role="alert"` and tied to the field via `aria-describedby`; 44 × 44 px minimum touch targets; colour is never the only signal (status chips include text); dialogs return focus to their trigger; date and time inputs use native controls for assistive-technology support.
