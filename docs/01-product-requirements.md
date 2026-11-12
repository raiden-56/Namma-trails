# 01 · Product requirements

## Vision

One trusted marketplace where travellers to Karnataka discover, compare and book tourism services — stays, boating, rentals, cabs, guides, adventure and experiences — from **independently registered and verified** local providers, and manage them as one trip.

**Principle:** one platform, many categories, one booking experience — without pretending that bookings with different providers are a single atomic reservation.

## Personas

| Persona | Needs | Primary surface |
|---|---|---|
| Traveller (domestic family, couple, backpacker, group) | Find trustworthy options fast, see real prices/availability, book several services for one trip, get help on the ground | Public site + traveller app (PWA) |
| Provider owner (boatman, homestay owner, scooty shop, cab operator, guide) | Get listed without paperwork pain, receive bookings, control availability, get paid on time | Provider portal (mobile-first) |
| Provider staff (receptionist, driver, boat operator) | See today's bookings assigned to them, mark service started/completed | Provider portal (restricted) |
| Verification admin | Review applications and documents quickly, with an audit trail | Admin dashboard |
| Operations / finance / support admins | Run destinations, moderate listings, resolve bookings, refunds, payouts, incidents | Admin dashboard |

## Scope by phase

| Phase | Outcome |
|---|---|
| 0 | Architecture, data model, API, permissions, design direction (this folder) |
| 1 | Design system and page shells for all four experiences |
| 2 | Database, auth (OTP + password), RBAC, logging, errors, API docs, file storage |
| 3 | **Provider self-registration & verification** — launch-critical |
| 4 | Destination & category CMS, listings, search, maps, listing moderation, favourites |
| 5 | Unified booking engine: availability strategies, holds, pricing, state machine, trips |
| 6 | Payments (Razorpay), webhooks, refunds, commission, payouts, invoices |
| 7 | Notifications, reviews, support tickets, incidents, SOS, trip sharing |
| 8 | Complete admin operations, analytics, settings |
| 9 | QA, security review, performance, accessibility, staging deployment |

Launch destinations: **Gokarna, Murudeshwar, Karwar, Udupi** (see [10](10-destination-launch.md)).

## Functional requirements (summary)

Detailed in the master brief; the docs below define *how*. Key acceptance rules that shape the architecture:

1. A provider is never publicly bookable until approved **and** its required documents are verified and unexpired ([04](04-provider-onboarding.md) publish gate).
2. Listing availability, prices, ratings and reviews shown to travellers come only from real provider data; no fabricated inventory. Development seed data is flagged `is_demo` and excluded when `DEMO_DATA_ENABLED=false` (enforced in production config validation).
3. Payment success is accepted only from server-side signature verification and signed webhooks.
4. Inventory cannot be oversold — enforced by row locks plus database CHECK/EXCLUDE constraints ([05](05-booking-engine.md)).
5. Every provider-scoped query is authorised against the caller's organisation membership ([03](03-roles-permissions.md)).
6. All money is integer paise; all business dates are IST calendar dates.
7. Commission, tax rates, fees, document requirements and cancellation policies are configuration, not code.

## Non-functional requirements

| Area | Target (initial launch) |
|---|---|
| Availability | 99.5% monthly for public + booking APIs |
| Performance | LCP < 2.5 s on 4G mid-range Android for public pages; API p95 < 300 ms for reads, < 800 ms for booking creation |
| Accessibility | WCAG 2.2 AA; full keyboard and screen-reader support; `prefers-reduced-motion` honoured |
| Security | OWASP ASVS L2 controls ([12](12-security-compliance.md)) |
| Privacy | DPDP Act 2023 design requirements; legal review before launch |
| Languages | English at launch; content model supports Kannada/Hindi later (`preferred_language`, CMS locale) |
| Scale assumption | Launch: < 2k bookings/day, < 50 req/s peak. Architecture scales to 10× without redesign |

## Definition of done (initial launch)

As listed in brief §27. Tracked line by line in [14 · Roadmap & progress](14-roadmap.md#definition-of-done-tracker). A visually complete prototype is **not** a production-ready marketplace.
