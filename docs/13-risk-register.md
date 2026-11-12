# 13 · Risk register

Likelihood and impact: L/M/H.

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| R-01 | **Cold start**: too few verified providers, so a destination looks empty | H | H | Destination-by-destination launch; `onboarding` status with a partner CTA; readiness thresholds before `active`; field onboarding drives; assisted onboarding by ops (staff can help but the provider still owns the account) | Business / Ops |
| R-02 | Providers struggle with digital KYC (low digital literacy, missing documents) | H | M | Mobile-first wizard; save-and-resume; clear category checklists; WhatsApp-assisted support; jurisdiction-aware requirements so nobody is asked for documents that don't apply | Product |
| R-03 | Legal requirements for boating, water sports and rentals vary by district and change | M | H | Requirements are configuration per category and district; legal review before launch; "approval ≠ certification" language; expiry tracking | Legal / Verification |
| R-04 | Overselling under concurrency (last room, last seat) | M | H | Row locks + CHECK/EXCLUDE constraints; holds with expiry; idempotent confirmation; concurrency integration tests (P5) | Engineering |
| R-05 | Payment captured but booking not confirmed (webhook delay, expired hold) | M | H | Webhook + verify both idempotent; reconciliation job against the gateway; automatic full refund when capacity is gone | Engineering / Finance |
| R-06 | Providers ignore request-to-book, so travellers wait | M | M | Response SLA with auto-expiry; no payment taken before acceptance; provider response-rate metric shown to admins; prefer instant confirmation where providers agree | Ops |
| R-07 | Monsoon and weather closures cause mass cancellations | H (seasonal) | M | Weather holds; full-refund rule for weather cancellations; destination `temporarily_unavailable`; clear seasonal messaging | Ops |
| R-08 | Tax treatment (GST on accommodation slabs, ECO TCS/TDS) implemented wrongly | M | H | All rates configurable; tax advisor sign-off; finance reports per tax head; nothing hard-coded | Finance |
| R-09 | Integer paise column overflow on aggregates (₹2.1 crore per row limit) | L | M | Per-booking values are far below the limit; payouts per provider per period are reviewed; migrate payout/report columns to `bigint` if any provider approaches ₹1 crore per period | Engineering |
| R-10 | Very new stack versions (NestJS 12 ESM, Next 16, Prisma 7, TS 6) have rough edges | M | M | Pinned exact versions; deliberately avoided the Prisma 8 RC and TS 7; upgrade on a schedule with CI | Engineering |
| R-11 | Hand-written DB constraints dropped by a generated Prisma migration | M | H | Documented review step; CI check that greps new migrations for `DROP` of known constraint and index names (P9) | Engineering |
| R-12 | No licensed photography; placeholder art undermines the premium feel | H | M | Art-directed placeholders for now; commission or license coastal photography before launch; `MediaFrame` swaps without code changes | Brand |
| R-13 | DPDP non-compliance (consent, retention, rights) | M | H | Design controls in [12](12-security-compliance.md); legal review; privacy notice versions recorded | Legal |
| R-14 | SMS deliverability (DLT templates, operator filtering) blocks OTP sign-in | M | H | DLT registration early; second provider as fallback; email OTP fallback for partners | Engineering / Ops |
| R-15 | Fraud: fake providers, fake reviews, coupon abuse | M | M | KYC; verified-booking reviews only; per-user coupon limits; anomaly reports | Trust & Safety |
| R-16 | Local Docker not running blocks DB-backed integration tests (resolved 2026-11-12: compose stack runs) | L | M | Start Docker Desktop (`pnpm db:up`), or point `DATABASE_URL` at a managed Postgres+PostGIS dev instance | Engineering |
| R-17 | Animation weight hurts mobile performance and accessibility | M | M | Rich motion only on desktop fine-pointer; reduced-motion fallbacks; GSAP lazy-loaded; Lighthouse budget in CI (P9) | Frontend |
| R-18 | Scope creep: building every module before any destination is live | H | H | Phased roadmap with the definition of done; multi-service checkout behind a flag; launch with the minimum categories per destination | Product |
