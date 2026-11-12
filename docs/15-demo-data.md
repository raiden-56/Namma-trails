# 15 · Demo data and test guide

For **local development only**. Everything here is fictional: businesses, people, phone numbers and reviews. Users, providers and services are flagged `is_demo`. Tax, commission and fee values are demo configuration, not tax advice. The API refuses to start in staging/production with the mock payment gateway or the console OTP sender, and refuses demo data in production.

```bash
pnpm db:seed:demo     # load demo data on top of the reference seed (idempotent: skips if already loaded)
pnpm db:reset:demo    # wipe the LOCAL database, re-run migrations, reference seed and demo seed
```

**Password for every demo account: `NammaDemo2026`**, using the **Email** tab on `/sign-in`. Mobile OTP also works; in development, codes appear in the API log or at `GET /api/v1/dev/outbox?to=+91…`.

## Accounts

| Role | Email | What to try |
|---|---|---|
| Super admin | superadmin@demo.example.com | Everything: overview, users, applications, destinations, listings, bookings, finance, support |
| Operations admin | ops@demo.example.com | Destinations, listing moderation, bookings |
| Verification admin | verify@demo.example.com | Review **Karwar Beach Cottages**: start review → verify documents → approve |
| Finance admin | finance@demo.example.com | Finance dashboard, payouts. Can't read KYC documents |
| Support admin | support@demo.example.com | Ticket queue, including an escalated safety incident. Can't see finance |
| Traveller | asha@demo.example.com | Has upcoming trips, a pending guide request and past trips with reviews |
| Traveller | rahul@, priya@, arjun@, meera@, sameer@demo.example.com | More histories, including a cancellation with a partial refund |
| Partner: homestay | ravi@demo.example.com | Sea Breeze Homestay (Gokarna). Rooms, weekend pricing, provider-funded coupon |
| Partner staff | anita@demo.example.com | Front desk at Sea Breeze: can manage bookings, can't see finance |
| Partner: boats | nagesh@demo.example.com | Om Coast Boat Rides: sunset rides, one listing pending moderation |
| Partner staff | manju@demo.example.com | Boat operator role: no booking list yet (assigning bookings to individual operators is not built), so the portal shows access denied |
| Partner: scooters | vinay@demo.example.com | Gokarna Scooty Point: time-window rentals with deposits |
| Partner: cabs | imran@demo.example.com | Coastline Cabs: operator-defined routes, cab assignment |
| Partner: boats + snorkelling | ganesh@demo.example.com | Netrani Blue Boats (Murudeshwar): request-to-book snorkelling trips |
| Partner: hotel | lakshmi@demo.example.com | Temple View Residency (Murudeshwar): a guest is checked in now |
| Partner: kayaking | joel@demo.example.com | Kali River Kayaking (Karwar) |
| Partner: guides + Yakshagana | sudha@demo.example.com | Udupi Heritage Walks: **pending requests to accept or decline** |
| Partner: ferry | prakash@demo.example.com | Malpe Island Ferry (Udupi) |
| Partner: in verification | deepa@demo.example.com | Karwar Beach Cottages: submitted, documents pending |
| Partner: info requested | kiran@demo.example.com | Udupi Self Drive: the verifier asked for a clearer document |

Coupons: **COAST10** (10%, max ₹300, platform-funded), **SEABREEZE500** (₹500 off stays over ₹5,000 at Sea Breeze, partner-funded).

## What the data contains

- All four launch destinations are **active** (demo only) with 14 listings and real photographs (see `/photo-credits`).
- Departures from 45 days ago to 30 days ahead. One weather-hold departure in two days shows the safety flow.
- About 40 bookings created **through the real booking engine on a simulated clock**: completed (most with reviews), upcoming confirmed, one in progress, requests awaiting partners, traveller cancellations with partial refunds, and a weather cancellation with a full refund.
- Settlements for every paid booking (commission, commission tax, demo GST TCS), and paid payouts for older eligible earnings.
- Four support tickets: refund query, escalated safety incident, cab complaint, resolved account issue.

## End-to-end scenarios

1. **Traveller books and pays:** sign in as asha → search Gokarna → *Sunset boat ride* → pick a departure → coupon COAST10 → Book → on checkout, *simulate success* → the trip is confirmed. Cancel it from the trip page to see the policy-based refund.
2. **Request to book:** sign in as rahul → *Udupi temple-town walk* → Request booking. Then sign in as sudha → Bookings → Requests → Accept → back as rahul → complete payment.
3. **Partner operations:** sign in as nagesh → Bookings → mark a booking started or completed → Finance shows commission, net earnings, pending settlement and payouts.
4. **Verification to listing:** sign in as verify → Provider applications → Karwar Beach Cottages → Start review → verify each document → Approve. Then as ops → Listings → publish its pending listing → it appears in Karwar search.
5. **Admin oversight:** finance → Finance (GBV, commission, refunds, payouts). support → Support → escalated safety ticket with internal notes. superadmin → Users, Bookings.

## Automated checks

```bash
pnpm test                                           # domain + API unit tests
RUN_DB_TESTS=1 pnpm --filter @kt/api test           # + booking concurrency tests against Postgres
PW_CHANNEL=msedge pnpm test:e2e                     # browser journeys (Playwright)
```
