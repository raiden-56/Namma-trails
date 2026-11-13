# Karnataka Tourism Marketplace

Working brand: **Namma Trails** (configurable in `apps/web/src/config/brand.ts`).

A multi-vendor marketplace where travellers book stays, boating, rentals, cabs, guides and experiences from verified local providers, starting in Gokarna, Murudeshwar, Karwar and Udupi.

> **Status:** the app works end to end with demo data: search, listing pages, booking, checkout with a test payment simulator, My Trips, the partner portal and the admin console. Email, SMS and file uploads are built as AWS integrations that you switch on with a setting; on your own computer nothing real is sent. Real payments and the screens for uploading documents are not built yet. Nothing is deployed, but the AWS setup is ready as code in [`infra/`](infra/README.md). See **[docs/14-roadmap.md](docs/14-roadmap.md)** for the verified progress checklist.

## What is in the app

| Area | What you get |
|---|---|
| Public site | Landing page, four town guides, seven category pages, search with filters, listing pages, a blog with four trip plans |
| Traveller | Sign in, booking panel with the full price, checkout, My Trips, cancel with a clear refund, reviews |
| Partner portal | Sign-up in seven steps, dashboard, listings, bookings, finance |
| Admin console | Partner applications, destinations, listings, users, bookings, finance, support tickets |
| Search engines | Titles, descriptions and keywords on every public page, a site map, structured data |
| User manual | Every feature explained with screenshots: **[docs/FEATURES.md](docs/FEATURES.md)**. The web app also shows it at `/user-manual` |

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 app: public site, traveller app, partner portal, admin. Has a `Dockerfile` |
| `apps/api` | NestJS 12 API, Prisma 7 schema and migrations. Has a `Dockerfile` |
| `packages/domain` | Framework-free business rules and shared Zod schemas (unit-tested) |
| `infra/` | AWS CDK app that hosts everything on AWS with auto scaling ([guide](infra/README.md)). It is its own small project with its own lockfile |
| `docs/` | Architecture and planning documents ([index](docs/README.md)) and the user manual |
| `.github/workflows/` | `ci.yml` (app checks), `infra.yml` (CDK checks), `deploy.yml` (deploy to AWS, started by hand) |

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

In development, OTP codes and all other messages are written to the API log (`[DEV ONLY]`) and nothing is sent. To send real email and SMS, set `MESSAGING_PROVIDER=aws` (Amazon SES and SNS); the settings are explained in `apps/api/.env.example`. Env validation refuses to start staging or production with the console sender, demo data enabled, or the example secrets.

Pages worth opening once it runs:

| Address | What it is |
|---|---|
| `http://localhost:3000/` | Landing page |
| `http://localhost:3000/blog` | Trip plans and sightseeing articles |
| `http://localhost:3000/user-manual` | The user manual, made from `docs/FEATURES.md` |
| `http://localhost:3000/design-system` | Every UI component on one page |
| `http://localhost:3000/sitemap.xml` | Site map for search engines |
| `http://localhost:4000/api/docs` | API docs (Swagger), in development only |

## Quality gates

```bash
pnpm typecheck     # all packages
pnpm test          # domain unit tests + API HTTP tests
pnpm --filter @kt/web build
pnpm --filter @kt/api exec prisma validate
```

The AWS code in `infra/` has its own checks. They need no AWS account and create nothing:

```bash
pnpm infra:install # once: installs the CDK packages inside infra/
pnpm infra:test    # type check + 15 tests on the generated AWS templates
pnpm infra:synth   # builds the AWS templates for the demo environment
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

## Docker images

Each app has a Dockerfile. Build both from the repository root:

```bash
docker build -f apps/api/Dockerfile -t namma-trails-api .
```

```bash
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://example.com --build-arg NEXT_PUBLIC_API_URL=https://example.com/api/v1 -t namma-trails-web .
```

- The web address is written into the web pages when the image is built, so a new address needs a new image.
- The API image also runs the database migration (`node_modules/.bin/prisma migrate deploy`) and the seed scripts.
- On AWS the API gets the database as five `DB_*` values and joins them into `DATABASE_URL` itself (`apps/api/docker-entrypoint.mjs`).
- On a company network that inspects HTTPS, the build needs the company root certificate: add `--secret id=extra_ca,src=/path/to/company-root.pem`.

## Deploy to AWS

The whole AWS setup is code in `infra/` (AWS CDK). **It has been tested on a computer but not deployed to a real AWS account yet.**

```
visitor -> CloudFront -> private load balancer -> web service (Next.js)
                                               -> API service (NestJS) -> PostgreSQL
```

- Both services run on ECS Fargate and scale by themselves on CPU and on requests.
- It is built to be cheap: no NAT gateway, Fargate Spot, one load balancer, a small database. Rough cost: about US$50 to 55 a month for the demo, and about US$160 to 175 for production at its smallest size.
- Email and SMS (Amazon SES and SNS), sign-in codes and rate limits (DynamoDB), image uploads (S3, served through CloudFront at `/media/...`), backups and log tracking (CloudWatch) are all part of it. Each is switched on by a setting.
- Only the **demo** environment can run today. The API refuses to start in staging or production mode until real payments are built.

Short version (needs an AWS login, the AWS CLI and Docker running):

```bash
cd infra
pnpm install
pnpm exec cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
pnpm exec cdk deploy --all -c env=demo
```

The full steps, the settings, the cost table and what to do on a company network are in **[infra/README.md](infra/README.md)**. The design choices are in [docs/11-deployment.md](docs/11-deployment.md).

## Rules that matter

- No fabricated listings, prices, ratings or availability. Seed data is reference configuration only; any demo rows must set `is_demo`.
- Written copy (blog, town guides) gives no prices, distances, travel times or "available" claims, so it cannot go out of date.
- Photos must be licensed and credited in `apps/web/src/content/photos.ts`. They are listed on `/photo-credits`.
- A provider is bookable only after approval with verified, unexpired documents ([docs/04](docs/04-provider-onboarding.md)).
- Payment success is trusted only after server-side verification.
- Money is integer paise; business dates are IST.
- Nothing is deleted for good. A "deleted" row is marked and kept (`deleted_at`, `removed_at` or `is_active`), uploaded files stay in storage, and a test fails if a real delete is added to the API code.
- Hand-written DB constraints live in `apps/api/prisma/sql/constraints.sql`. Review every generated migration so it doesn't drop them.
