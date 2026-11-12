# 12 · Security & compliance checklist

✅ in place now · 🔜 planned (phase) · ⚖️ needs legal or tax sign-off.

## Application security

| Control | Status |
|---|---|
| Deny-by-default global auth guard; `@Public()` opt-out | ✅ (tested) |
| Permission checks server-side; org permissions checked against the resource's own provider | ✅ |
| Argon2id password hashing (OWASP parameters); constant-time sign-in for unknown accounts | ✅ |
| OTP: 6 digits, HMAC-peppered hash, 5-minute TTL, 5 attempts, 5 sends/hour/destination, single use with a race guard | ✅ |
| Access JWT 15 min (HS256, algorithm pinned); rotating opaque refresh tokens stored as SHA-256; reuse detection revokes the family; password reset revokes all sessions | ✅ |
| Refresh cookie httpOnly, Secure (non-dev), SameSite=Strict, path-scoped; Origin check on cookie endpoints | ✅ |
| Input validation with shared Zod schemas; 1 MB JSON body limit | ✅ |
| Structured error envelope; no stack traces or SQL in responses; DB outages → 503 | ✅ (tested) |
| Helmet security headers; strict CORS allow-list with credentials | ✅ |
| Rate limiting (global + per-route on auth) | ✅ (in-memory) → 🔜 Redis store for multiple instances (P5) |
| Log redaction of auth headers, cookies, passwords and OTPs; request IDs | ✅ |
| Env validation; unsafe production configuration refuses to boot (console SMS, demo data, example secrets) | ✅ |
| Audit log in the same transaction for admin and provider mutations; append-only via trigger | ✅ |
| SQL injection: Prisma parameterisation; raw SQL only as tagged templates | ✅ |
| XSS: React escaping; no `dangerouslySetInnerHTML` for user content; CSP | ✅ / 🔜 CSP nonce policy (P9) |
| CSRF: bearer tokens for API mutations; cookie only on refresh/sign-out with SameSite=Strict + Origin check | ✅ |
| File uploads: pre-signed, size and MIME allow-list, magic-byte sniffing, SHA-256, malware-scan hook, private bucket, short-lived signed reads, audited views | 🔜 P3 |
| Idempotency keys for checkout, payment, refund and cancellation | schema ✅ / 🔜 P5 |
| Payment: server-computed amounts; signature verification; signed, idempotent webhooks | 🔜 P6 |
| Dependency scanning (Dependabot / `pnpm audit`), secret scanning, SAST in CI | 🔜 P9 |
| Admin 2FA (TOTP) and session timeout for admin roles | 🔜 P8 |
| Penetration test before public launch | 🔜 P9 |

## Data protection (DPDP Act 2023 and Rules) ⚖️

Treated as design requirements; legal review is required before launch.

- **Notice and consent:** consent version and timestamp are recorded on the profile at sign-up (✅ field and API); granular marketing opt-in is off by default (✅ field).
- **Purpose limitation and minimisation:** providers get traveller contact details only for their own bookings, inside a time window; licence numbers are masked.
- **Data principal rights:** access/export and correction via `/account`; deletion = soft delete + anonymisation after retention (🔜 P7). Grievance officer contact goes in the privacy notice.
- **Security safeguards:** encryption in transit (TLS) and at rest (RDS/S3 KMS); KYC in a separate private bucket; access to KYC limited to `provider.document.read_private` and audited.
- **Breach response:** incident runbook with notification to the Data Protection Board and affected users within the prescribed timelines (🔜 P9).
- **Children:** the platform is for adults (18+) to transact. Minors appear only as guests within a booking; no profiling of children.
- **Data residency:** Mumbai region (see [11](11-deployment.md)).

## Payments and tax ⚖️

- Card data never touches our servers (Razorpay Checkout); PCI DSS scope is SAQ-A.
- GST on services, platform fees and commission, plus e-commerce operator obligations (TCS under GST s.52, TDS under IT s.194-O), are **configuration** (`tax_rules`, withholdings, `categories.tax_remitter`) set by finance after tax advice. Invoice numbering is unique and sequential per series (🔜 P6).
- Refunds go only to the original payment method through the gateway.

## Trust and safety

- Provider verification with category- and jurisdiction-specific documents, expiry tracking and automatic de-listing on expiry (✅ rules, 🔜 jobs in P3).
- Public copy must not imply that approval certifies legal compliance (see [04](04-provider-onboarding.md)).
- Boats and adventure: safety information on each listing, minimum age and participant limits, weather holds with full refunds.
- Rentals: licence capture at booking, verification at pickup, inspection photos at pickup and return.
- Verified reviews only (one per completed booking); provider responses; moderation (`hidden`/`flagged`).
- Reporting and incidents: support tickets with `safety_incident` category, priority escalation, internal notes; SOS entry point in the trip view (emergency numbers + share trip + alert support) 🔜 P7.
- Fraud signals: OTP velocity, coupon abuse (per-user limits), chargeback tracking, unusual cancellation patterns per provider (🔜 P8).
