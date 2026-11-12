# 09 · Pages & routes

Legend: **B** = built in Phase 1 (design and shell; data wiring noted) · **P*n*** = planned phase.

## Public website — `app/(public)`

| Route | Status | Purpose / data |
|---|---|---|
| `/` | B | 11 homepage sections: hero with search, what-it-is statement, how it works (traveller, partner and team flows), destinations, trip plans from the blog, categories, live listings, feature list, trust, partner call, travel guides. Live listings use API data, otherwise an honest empty state. Screenshots: [FEATURES.md](FEATURES.md) |
| `/destinations` | B | launch destinations (editorial seed content; CMS API in P4) |
| `/destinations/[slug]` | B | overview, attractions, category tabs, map abstraction, tips, FAQs, structured data; SSG for the 4 launch destinations |
| `/explore` | B | search results: filters (bottom sheet on mobile), list/map toggle, sort; calls `/search/services` (P4) |
| `/stays`, `/boating`, `/rentals`, `/cabs`, `/guides`, `/experiences`, `/packages` | B | category landings from one config-driven `CategoryLanding` |
| `/services/[slug]` | B (shell) | listing detail; API-backed, otherwise 404. Gallery, availability calendar and booking panel in P4–P5 |
| `/providers/[slug]` | P4 | public provider profile (verified badge, listings, reviews) |
| `/partner/join` | B | "Become a partner" page |
| `/partner/register` | B, **wired** | 7-step onboarding: account → OTP (creates the account) → business → categories → location → document checklist → submit (creates the application and sets its scope) |
| `/sign-in` | B, **wired** | mobile OTP and email/password; routes by real roles from `/auth/me` |
| `/blog`, `/blog/[slug]` | B | blog: four trip-plan and sightseeing articles (editorial seed content in `content/blog.ts`, SSG; CMS editing in P7) |
| `/user-manual` | B | the public user manual: [FEATURES.md](FEATURES.md) rendered as a static page, with its screenshots from `apps/web/public/manual/` |
| `/guides/[slug]` | P7 | CMS travel guides |
| `/legal/terms`, `/legal/privacy`, `/legal/partner-agreement` | P7 | CMS legal pages (after legal review) |
| `/sitemap.xml`, `/robots.txt`, `/icon.svg` | B | SEO: site map (static pages, towns, blog, manual and every published listing from the search API), robots rules, site icon. Keywords live in `config/seo.ts` |

## Traveller app — `app/(traveler)` (bottom nav on mobile)

| Route | Status |
|---|---|
| `/trips` | B (empty state) → P5 list of trips with derived status |
| `/trips/[reference]` | P5: itinerary, per-booking status, QR tickets, cancel, share, SOS |
| `/checkout/[tripId]` | P5–P6 |
| `/saved` | B (empty state) → P4 favourites |
| `/account` | B (shell) → P2/P7: profile, saved travellers, emergency contacts, notifications, payment history, invoices, privacy (export or delete my data) |
| `/support`, `/support/[reference]` | P7 |

## Provider portal — `app/(portal)/partner`

| Route | Status |
|---|---|
| `/partner` | B: dashboard shell (KPI tiles show "—" until wired; verification banner) |
| `/partner/application` | P3: status, missing documents, uploads, admin messages, history |
| `/partner/services`, `/partner/services/new`, `/partner/services/[id]` (details, media, locations, inventory, availability, pricing, policies) | P3–P5 |
| `/partner/bookings`, `/partner/bookings/[ref]`, `/partner/calendar` | P5 |
| `/partner/finance` (earnings, settlements, statements) | P6 |
| `/partner/team` (staff and roles) | P3 |
| `/partner/reviews`, `/partner/settings` (payout account, profile) | P6–P7 |

## Admin — `app/(admin)/admin`

| Route | Status |
|---|---|
| `/admin` | B: dense KPI grid and provider-application table (empty state) |
| `/admin/providers`, `/admin/providers/[id]` (KYC review workspace) | P3 |
| `/admin/documents/expiring` | P3 |
| `/admin/destinations`, `/admin/destinations/[slug]` (content, categories, readiness, launch) | P4 |
| `/admin/listings` (moderation queue) | P4 |
| `/admin/bookings`, `/admin/trips/[ref]`, `/admin/refunds`, `/admin/disputes` | P5–P6 |
| `/admin/finance` (commission rules, payouts, tax rules, coupons, reports) | P6 |
| `/admin/support`, `/admin/incidents` | P7 |
| `/admin/cms/*`, `/admin/users`, `/admin/roles`, `/admin/settings`, `/admin/feature-flags`, `/admin/audit` | P8 |

## Internal

`/design-system` (B, noindex): the token and component showcase.
