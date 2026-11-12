# 11 · Deployment & hosting

Nothing is deployed yet. This is the target design; the staging deployment happens in Phase 9 and will be recorded here once it has been verified.

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
