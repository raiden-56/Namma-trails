# 07 · API specification

Live OpenAPI document (non-production): `GET /api/docs` (UI) and `/api/docs-json`.

## Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1/...` (URI versioning). Health endpoints are unversioned: `/health`, `/health/ready` |
| Auth | `Authorization: Bearer <access JWT>` (15 min). Refresh via httpOnly cookie `kt_rt` (path `/api/v1/auth`, SameSite=Strict) on `POST /auth/refresh` |
| Deny by default | every route requires auth unless `@Public()` |
| Validation | Zod schemas shared with the web app; 422 `VALIDATION_FAILED` with `details: [{ path, message }]` |
| Success shape | `{ data: … }` for resources; lists `{ data: [...], meta: { page, pageSize, total } }` |
| Error shape | `{ error: { code, message, details?, requestId } }` |
| Status codes | 400 malformed · 401 unauthenticated · 403 forbidden · 404 not found · 409 state conflict (invalid transition, stale status, duplicate) · 422 validation/business rule · 429 rate limited · 503 dependency unavailable |
| Pagination | `page` (1-based), `pageSize` (≤ 100) |
| Sorting/filtering | explicit allow-listed query params per endpoint (`sort=price_asc`, …) |
| Idempotency | `Idempotency-Key` header **required** on checkout, payment verification, refund and cancellation; same key + same body → same stored response; same key + different body → 409 |
| Rate limits | global 120/min per IP; OTP request 5/min and 5/hour per destination; sign-in 10/min |
| Request IDs | `X-Request-Id` accepted/generated, echoed in logs and error bodies |
| Money/time | paise integers; ISO-8601 instants; `YYYY-MM-DD` IST calendar dates |

## Endpoint inventory

Status: 🟡 implemented and compiling; auth-guard and validation behaviour covered by `apps/api/test/http-security.test.ts`, but **not yet exercised against a database** (blocked until Postgres is running locally) · ⬜ planned (phase).

### Auth — `/auth`
| | Method & path | Notes |
|---|---|---|
| 🟡 | POST `/auth/otp/request` | `{ channel, destination, purpose }` → 202 `{ expiresInSeconds }`; never reveals account existence |
| 🟡 | POST `/auth/otp/sign-in` | phone + code (+ optional fullName); creates traveller on first use; returns access token, sets refresh cookie |
| 🟡 | POST `/auth/sign-up` | fullName, phone, email?, password?, otpCode, termsVersion? |
| 🟡 | POST `/auth/sign-in` | email + password (argon2id, constant-time on unknown accounts) |
| 🟡 | POST `/auth/password/reset` | email + reset OTP + new password; revokes all sessions |
| 🟡 | POST `/auth/refresh` | rotates refresh token; reuse revokes the session family; Origin checked |
| 🟡 | POST `/auth/sign-out` | revokes refresh token, clears cookie |
| 🟡 | GET `/auth/me` | profile, roles, effective permissions, provider memberships |

### Catalog — public
| | | |
|---|---|---|
| 🟡 | GET `/categories` | active categories |
| 🟡 | GET `/destinations` | launch status + per-category availability computed from real bookable listings |
| 🟡 | GET `/destinations/{slug}` | content, attractions, FAQs, categories |

### Provider onboarding — `/provider-onboarding/applications`
| | | |
|---|---|---|
| 🟡 | POST `/` | start application (caller becomes owner) |
| 🟡 | GET `/{providerId}` | status, documents, missing requirements, provider-visible history |
| 🟡 | PUT `/{providerId}/business` | editable in draft / info_requested / rejected |
| 🟡 | PUT `/{providerId}/scope` | `{ categoryKeys, destinationSlugs }` |
| 🟡 | POST `/{providerId}/submit` | requires all mandatory documents |
| ⬜ P3 | POST `/{providerId}/documents/upload-url` → PUT to storage → POST `/{providerId}/documents` | pre-signed private upload, server-side verification |
| ⬜ P3 | POST `/{providerId}/reopen` | rejected → draft |

### Provider portal — `/providers/{providerId}/…` (all org-scoped)
⬜ P3–P5: `members` (invite, role change, revoke), `payout-accounts`, `services` (CRUD, media, locations, submit for review, pause), `inventory-items`, `availability-rules`, `slots` (generate, close, weather hold), `day-overrides`, `blackouts`, `price-plans`, `seasonal-rules`, `bookings` (list, accept, reject, start, complete, assign resource), `finance/summary`, `finance/statements`, `reviews/{id}/response`, `dashboard`.

### Search & availability — public
⬜ P4: GET `/search/services` (destination, category, dates, guests, price, rating, language, `near`+`radiusKm` via PostGIS, sort), GET `/services/{slug}`, GET `/providers/{slug}`.
⬜ P5: GET `/services/{id}/availability` (calendar/slots), POST `/bookings/quote`.

### Trips, bookings, payments — traveller
⬜ P5: POST `/trips`, POST/DELETE `/trips/{id}/items`, POST `/trips/{id}/checkout` (Idempotency-Key), GET `/trips`, GET `/trips/{id}`, POST `/bookings/{id}/cancel` (preview + confirm), GET `/bookings/{id}/ticket` (QR).
⬜ P6: POST `/payments/verify`, POST `/payments/webhooks/razorpay` (raw body, HMAC verified, idempotent by event id), GET `/payments/history`, GET `/invoices/{id}`.

### Media (file uploads) — `/media`

Files go straight from the browser to Amazon S3; the API only signs and checks.

| Method | Path | What it does |
|---|---|---|
| POST | `/media/uploads` | Start an upload. Body: `purpose` (`service_photo`, `destination_photo`, `provider_document`), `mimeType`, `sizeBytes`, `providerId`. Returns a one-time `uploadUrl` (PUT, 5 minutes) |
| POST | `/media/uploads/{id}/complete` | The server checks the file that arrived. Returns the public address of a photo (`null` for a private document) |
| GET | `/media/{id}/download-url` | A 60-second link to read a file. Private documents: the owning organisation or a reviewer only |
| DELETE | `/media/{id}` | Soft delete: the file is hidden, not destroyed |

Photos need `org.listing.manage` (or `destination.manage` for town photos); documents need `org.documents.manage`. Public files are served at `MEDIA_BASE_URL/media/...` (on AWS: CloudFront in front of S3).

### Customer experience
⬜ P4/P7: `/me/favourites`, `/me/travellers`, `/me/emergency-contacts`, `/reviews` (completed bookings only), `/notifications`, `/support/tickets` (+ messages, incident reports, SOS context), `/trips/{id}/share`.

### Admin — `/admin/…` (platform permissions)
| | | |
|---|---|---|
| 🟡 | GET `/admin/provider-applications` | `provider.application.read`; oldest-first SLA queue |
| 🟡 | POST `/admin/provider-applications/{id}/decision` | `provider.application.review`; start_review / approve (all docs verified) / reject / request_info / suspend / reinstate |
| ⬜ P3 | POST `/admin/documents/{id}/verify` · `/reject`; GET `/admin/documents/{id}/view-url` (signed, audited) | |
| ⬜ P4 | `/admin/destinations` (CRUD, status, readiness), `/admin/categories`, `/admin/listings` (moderation queue, approve, request changes, disable), `/admin/cms/*` | |
| ⬜ P5–P6 | `/admin/bookings`, `/admin/trips`, `/admin/refunds`, `/admin/disputes`, `/admin/commission-rules`, `/admin/payouts`, `/admin/tax-rules`, `/admin/coupons`, `/admin/reports/*` | |
| ⬜ P7–P8 | `/admin/support/*`, `/admin/users`, `/admin/roles`, `/admin/feature-flags`, `/admin/settings`, `/admin/audit-logs`, `/admin/system/health` | |

## Webhooks

`POST /api/v1/payments/webhooks/razorpay` (Phase 6): raw body preserved; `X-Razorpay-Signature` verified with HMAC-SHA256 using the webhook secret (constant-time compare); event stored in `payment_events` with `UNIQUE (gateway, gateway_event_id)`; processing is idempotent and retried by a job if it fails; responds 2xx only after the event is durably stored. The frontend's payment callback is treated as a hint only — `POST /payments/verify` re-verifies the signature server-side, and the order amount is always the server-computed one.
