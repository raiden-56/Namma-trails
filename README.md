# Karnataka Tourism Marketplace

Working brand: **Namma Trails** (configurable in `apps/web/src/config/brand.ts`).

A multi-vendor marketplace where travellers book stays, boating, rentals, cabs, guides and experiences from verified local providers, starting in Gokarna, Murudeshwar, Karwar and Udupi.

> **Status:** Phase 0 (architecture) and Phase 1 (design system) are complete. Phase 2 (backend foundation) and Phase 3 (provider onboarding) are partly built. Nothing is deployed. See **[docs/14-roadmap.md](docs/14-roadmap.md)** for the verified progress checklist.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 app: public site, traveller app, partner portal, admin |
| `apps/api` | NestJS 12 API, Prisma 7 schema and migrations |
| `packages/domain` | Framework-free business rules and shared Zod schemas (unit-tested) |
| `docs/` | Architecture and planning documents ([index](docs/README.md)) |

## Prerequisites

Node 22+ (tested on 24), pnpm 11, Docker Desktop (for Postgres + PostGIS, Redis, S3Mock and Mailpit).

## Local setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env       # dev defaults; DB on port 5433
cp apps/web/.env.example apps/web/.env.local

pnpm db:up                                   # docker compose: postgres(5433) redis s3mock(9090) mailpit(8025)
pnpm --filter @kt/domain build
pnpm --filter @kt/api build                  # also runs prisma generate
pnpm --filter @kt/api exec prisma migrate deploy
pnpm db:seed                                 # reference data only: roles, categories, document rules, 4 destinations
pnpm --filter @kt/api admin:create -- --phone 9XXXXXXXXX --name "Your Name" --role super_admin

pnpm dev:api                                 # http://localhost:4000  (Swagger: /api/docs)
pnpm dev:web                                 # http://localhost:3000  (design system: /design-system)
```

In development, OTP codes are written to the API log (`[DEV ONLY]`). Env validation refuses to start staging or production with the console sender, demo data enabled, or the example secrets.

## Quality gates

```bash
pnpm typecheck     # all packages
pnpm test          # domain unit tests + API HTTP tests
pnpm --filter @kt/web build
pnpm --filter @kt/api exec prisma validate
```

## Demo data (test every feature locally)

```bash
pnpm db:seed:demo      # fictional partners, listings, bookings, payouts, reviews, tickets (is_demo)
```

Every demo account uses the password `NammaDemo2026`. The list of accounts and step-by-step test scenarios for travellers, partners and each admin role is in **[docs/15-demo-data.md](docs/15-demo-data.md)**. Payments use a development-only simulator; nothing real is charged.

## End-to-end tests (Playwright)

Runs against the real stack: start dependencies, migrate and seed, and build the API first (see Local setup). Running servers on :3000/:4000 are reused; otherwise Playwright starts them.

```bash
pnpm test:e2e                                   # bundled Chromium
PW_CHANNEL=msedge pnpm test:e2e                 # use installed Edge (where browser downloads are blocked)
pnpm --filter @kt/web exec playwright show-report
```

Each run creates a fresh traveller and partner through the UI, and resets a dedicated `e2e-admin@example.com` super admin with a random password that is never written to disk. OTP codes are read from `GET /api/v1/dev/outbox`, a development-only route that exists only with `MESSAGING_PROVIDER=console`, which env validation forbids in staging and production. Test users accumulate in the local database; their names start with "E2E".

## Rules that matter

- No fabricated listings, prices, ratings or availability. Seed data is reference configuration only; any demo rows must set `is_demo`.
- A provider is bookable only after approval with verified, unexpired documents ([docs/04](docs/04-provider-onboarding.md)).
- Payment success is trusted only after server-side verification.
- Money is integer paise; business dates are IST.
- Hand-written DB constraints live in `apps/api/prisma/sql/constraints.sql`. Review every generated migration so it doesn't drop them.
