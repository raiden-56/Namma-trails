# 11 · Deployment & hosting

Nothing is deployed yet. This is the target design; the staging deployment happens in Phase 9 and will be recorded here once it has been verified.

## What is in the repository now

The AWS setup is written as code in [`infra/`](../infra/README.md) (AWS CDK, TypeScript), with a Dockerfile for the web app and one for the API. It has been type-checked, tested and synthesized, and both images were run locally. **It has not been deployed to an AWS account yet.** The step-by-step guide, the settings and the cost estimate are in [`infra/README.md`](../infra/README.md).

It follows the recommendation below, with these choices made to keep the bill low:

| Topic | Target design below | What `infra/` does today | Why |
|---|---|---|---|
| Addresses | `www.` for web, `api.` for the API | One address: `/api/*` and `/health` go to the API, the rest to the web app | One load balancer instead of two, and sign-in cookies stay same-site |
| Load balancer | Public ALB behind CloudFront | Internal ALB that only CloudFront can reach (CloudFront VPC origin) | No public address to pay for or protect |
| Network | Not decided | No NAT gateway: tasks in public subnets, firewall lets only the load balancer in | About US$40 a month saved per gateway. A switch turns NAT on |
| Compute | Fargate | Fargate with auto scaling, on Fargate Spot (all tasks in the demo; all but the first in production) | About 70% off compute |
| Migrations | A one-off ECS task per release | A first container in every API task runs `prisma migrate deploy` | No separate pipeline step; a failed migration stops the release by itself |
| Redis, WAF | Listed | Redis is a switch (off: the API does not use it). WAF is on for production only | Pay only for what the code uses |
| Email and SMS | SES; MSG91 or Twilio | Amazon SES for email and Amazon SNS for SMS, switched on with `messagingProvider: "aws"` | Billed per message, no monthly fee. SMS to India still needs a DLT registration |
| Short-lived data | Redis | DynamoDB for sign-in codes and rate-limit counters | Billed per request, shared by all tasks, cleans itself up. Bookings and payments stay in PostgreSQL |
| Files | S3 public and private buckets | The same, with uploads through one-time links and photos served by CloudFront at `/media/...` | Files never pass through the API tasks |
| Backups | RDS snapshots + weekly dump | RDS automatic backups, plus an AWS Backup plan (nightly and weekly) in production | A second copy that outlives the database |
| Logs | CloudWatch | Container logs, counts of errors / audited actions / failed messages, alarms and one dashboard | Free or close to it at this size |
| Test environment | Not planned | `stage`: the whole app on one small EC2 server that is started and stopped by hand (and stopped every night by a schedule). About US$5 a month while off | Testing without paying for a load balancer and a managed database |
| Environments | Staging and production | `stage`, `demo` (API in development mode with demo data) and `production` | The API cannot start in staging or production mode until real payments are built |
| Cost | US$350 to 700 a month | About US$50 to 55 (demo) and US$160 to 175 (production at its smallest) | Rough estimates; see the guide |

## Recommendation

Use AWS **Mumbai (`ap-south-1`)** for everything that stores personal data, with managed services so a small team can run it.

| Component | Recommended | Alternative (lower cost or ops) |
|---|---|---|
| Web (Next.js) | AWS ECS Fargate behind ALB + CloudFront | Vercel (Mumbai edge, `bom1` functions), keeping all PII API calls in the AWS API |
| API + workers | ECS Fargate (separate `api` and `worker` services from one image) | Render or Railway (check region and DPDP posture first) |
| PostgreSQL + PostGIS | Amazon RDS for PostgreSQL 17, Multi-AZ in production, PITR backups | Neon or Supabase (Mumbai) for staging |
| Redis | ElastiCache (Valkey/Redis) | Upstash (Mumbai) |
| Object storage | S3: `public` bucket behind CloudFront; `private` KYC bucket with Block Public Access, SSE-KMS, and signed URLs only | Cloudflare R2 for public media |
| Email / SMS | Amazon SES (Mumbai); MSG91 or Twilio with DLT-registered templates | |
| Secrets | AWS Secrets Manager → ECS task env | Doppler |
| DNS / TLS | Route 53 + ACM certificates (auto-renew); HSTS | Cloudflare |
| WAF | AWS WAF managed rules + rate rules on `/auth/*` | Cloudflare WAF |
| Monitoring | Sentry (errors), CloudWatch logs and alarms, uptime checks on `/health/ready`, OpenTelemetry traces | Grafana Cloud |

**Why:** data stays in India, which keeps the DPDP and payment-data posture simple. Managed Postgres with PITR and Multi-AZ suits a booking ledger. A single container image for the API and workers keeps deploys simple. Estimated launch cost: roughly US$350–700 a month for production plus staging at launch traffic; validate with the AWS calculator before committing.

## Environments

| Env | Purpose | Data |
|---|---|---|
| local | docker-compose (Postgres on **5433**, Redis, S3Mock, Mailpit) | seed reference data |
| preview | per-PR web previews (optional) | staging API |
| staging | production-like; Razorpay **test** keys; console messaging forbidden | seed + synthetic test accounts flagged `is_demo` |
| production | live | real only; `DEMO_DATA_ENABLED=false` is enforced at boot |

## CI/CD (GitHub Actions; workflow in `.github/workflows/ci.yml`)

1. On every PR: install with a frozen lockfile → `prisma validate` → typecheck all packages → unit tests (domain, API) → web build. Later: Playwright E2E against docker-compose services, axe and Lighthouse CI.
2. On merge to `main`: build and push the image (tagged by git SHA) → run `prisma migrate deploy` as a one-off ECS task against staging → deploy staging → smoke tests (`/health/ready`, key pages) → manual approval → production with the same image.
3. Rollback: redeploy the previous image tag. Migrations are **expand/contract** (add columns/tables first, backfill, switch code, drop later), so the previous image always works with the current schema. A destructive migration needs a separate, explicitly approved release.

## Database operations

- `prisma migrate deploy` only; never `migrate dev` against shared environments. Review generated SQL for drops of objects defined in `prisma/sql/constraints.sql`.
- Backups: RDS automated snapshots (35 days) + PITR + a weekly logical dump to a separate account. **Restore drill monthly** (Phase 9 checklist).
- Connection pooling: RDS Proxy, or PgBouncer in transaction mode; Prisma pool size per task tuned to the instance's `max_connections`.

## Domains

`www.<brand>.in` (web), `api.<brand>.in` (API), `media.<brand>.in` (CloudFront public bucket). The refresh cookie is scoped to the API host. With web and API as subdomains of the same registrable domain, requests are same-site, so `SameSite=Strict` works.

## Health checks

`GET /health` (liveness) and `GET /health/ready` (readiness: database; Redis and queues from Phase 5). The load balancer routes only to ready tasks. Alarms fire on 5xx rate, p95 latency, readiness failures, queue depth, failed webhooks and failed payouts.
