# Namma Trails user manual

This manual explains, in simple words, what the app does today and how to use it. Every screen has a screenshot. The same manual is public on the website at `/user-manual`.

- [1. What the app is](#1-what-the-app-is)
- [2. The landing page](#2-the-landing-page)
- [3. The header](#3-the-header)
- [4. The user flow, step by step](#4-the-user-flow-step-by-step)
- [5. Traveller features](#5-traveller-features)
- [6. Partner features](#6-partner-features)
- [7. Team (admin) features](#7-team-admin-features)
- [8. Search engines (SEO)](#8-search-engines-seo)
- [9. What is not built yet](#9-what-is-not-built-yet)
- [10. How to run the app and remake the screenshots](#10-how-to-run-the-app-and-remake-the-screenshots)

> **About the data in the screenshots.** All listings, people, prices and reviews you see are **demo data** made for local testing. Nothing is real. Payments use a test simulator, so no money moves.

---

## 1. What the app is

**Namma Trails** is a marketplace for a trip to the Karnataka coast. A traveller can book a stay, a boat ride, a scooty or car, a cab, a local guide or an activity. Each one is offered by a local business ("partner"). A partner can take bookings only after our team has checked its documents.

The app starts with four towns: **Gokarna, Murudeshwar, Karwar and Udupi**.

Three groups of people use it:

| Who | What they use | What they do |
|---|---|---|
| Traveller | Public site and "My Trips" | Search, see the price, book, pay, follow the booking, cancel, review |
| Local partner | Partner portal (`/partner`) | Register the business, answer booking requests, run bookings, see earnings |
| Our team | Admin console (`/admin`) | Check partners, check listings, open towns, watch bookings and money, handle support |

**How it is built**

| Part | Technology | Folder |
|---|---|---|
| Website | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | `apps/web` |
| API | NestJS 12, Prisma 7 | `apps/api` |
| Business rules | Plain TypeScript, unit-tested | `packages/domain` |
| Database and tools | PostgreSQL with PostGIS, Redis, S3Mock, Mailpit (Docker) | `docker-compose.yml` |

---

## 2. The landing page

The landing page (`/`) was redesigned. It now shows the flow of the app and every feature it has. The code is in `apps/web/src/app/(public)/page.tsx` and `apps/web/src/components/sections/home/`.

![The top of the landing page on a desktop screen](../apps/web/public/manual/landing-hero.jpg)

The page has eleven parts, from top to bottom:

| # | Part | What it shows |
|---|---|---|
| 1 | Hero | A bright photo of the Gokarna coast (blue sky, green headland, blue sea), the main headline, the four towns from north to south, and the search bar |
| 2 | One-sentence summary | What you can book, with small photos inside the sentence |
| 3 | How it works | The steps for travellers, partners and our team, drawn as a trail with five stops |
| 4 | Launch destinations | The four towns as large cards |
| 5 | Trip plans from the blog | One large article card and three more articles as a list |
| 6 | Categories | The seven kinds of service as a list with a photo |
| 7 | Live listings | Real listings from the API, with one tab for each kind of service |
| 8 | Feature list | Everything the app does, grouped by who uses it |
| 9 | Why book with us | Six trust rules |
| 10 | Become a partner | A call for local businesses |
| 11 | Know before you go | Short travel notes for each town |

Full-page pictures: [desktop](../apps/web/public/manual/landing-desktop.jpg) · [phone](../apps/web/public/manual/landing-mobile.jpg)

### The search bar: lists and calendar

The search bar does not use the browser's own dropdown and date box. It has its own list and its own calendar, drawn in the site's style, so they look the same in every browser and on every phone.

- **Where** and **What** open a list. Your choice has a tick next to it.
- **From** and **To** open a month calendar. Days in the past cannot be chosen. Today has a small dot. The days between the two dates are shaded. **Clear** removes a date.
- With a keyboard: the arrow keys move, Enter chooses and Esc closes. In a list you can also type the first letter.

![The calendar open in the search bar, with the days of the trip shaded](../apps/web/public/manual/search-calendar.jpg)

The same list and calendar are used everywhere else too: in the booking panel (room type, vehicle, route, time and dates), in the sort box on the results page, in the partner sign-up form and in the admin filters.

### Back to top

After you scroll down, a round button with an arrow shows in the bottom right corner. It takes you back to the top of the page. It is on every public page.

![The back-to-top button in the bottom right corner](../apps/web/public/manual/back-to-top.jpg)

### How it works (the flow section)

This part has three tabs. Each tab shows five steps on a dotted trail.

![How it works: the steps for travellers](../apps/web/public/manual/landing-flow-traveller.png)

![How it works: the steps for local partners](../apps/web/public/manual/landing-flow-partner.png)

![How it works: the steps for our team](../apps/web/public/manual/landing-flow-team.png)

### Launch destinations

The four towns are shown as large cards. On a desktop the cards slide over each other as you scroll. On a phone you swipe them sideways.

![The launch destinations section](../apps/web/public/manual/landing-destinations.jpg)

### Trip plans from the blog

Four articles from the blog: a 1-day trip, a 7-day plan, a sightseeing list and plans for Uttara Kannada. The button "All articles" opens the blog.

![The blog section on the landing page](../apps/web/public/manual/landing-blog.jpg)

### Categories

Seven kinds of service. On a desktop, the photo on the right changes when you point at a row. Below the photo you see what you choose when you search that kind of service.

![The category list with its photo](../apps/web/public/manual/landing-categories.jpg)

### Live listings

These cards come from the search API. If no verified partner has a listing yet, the section says so. It never shows made-up listings.

![Live listings with tabs](../apps/web/public/manual/landing-live-listings.jpg)

### Feature list

![The feature list on the landing page](../apps/web/public/manual/landing-features.png)

### Trust rules and the partner call

![Why book with us](../apps/web/public/manual/landing-trust.png)

![Become a partner](../apps/web/public/manual/landing-partner.jpg)

### On a phone

The page works at phone width. The links sit in one row that you swipe. The search bar becomes one button that opens a sheet. The lists and the calendar open on top of that sheet. The trail in "How it works" runs down the left side.

<img src="../apps/web/public/manual/landing-mobile-hero.jpg" alt="The top of the landing page on a phone" width="300"> <img src="../apps/web/public/manual/mobile-search-dropdown.jpg" alt="The search sheet on a phone with the list of towns open" width="300">

---

## 3. The header

The header is the bar at the top of every public page. It was changed together with the landing page. The code is in `apps/web/src/components/layout/PublicHeader.tsx` and `apps/web/src/features/auth/session.tsx`.

**On a computer** the header shows every link at once: Destinations, all seven categories and Blog, then Become a Partner and the account button. On very wide screens there is also a My Trips link.

![The header on a desktop screen with all links](../apps/web/public/manual/header-desktop.jpg)

**On a phone** the top bar shows only the logo and the account button. The links sit in one row under it. You swipe the row sideways to see the rest. The page you are on is underlined and stays in view.

<img src="../apps/web/public/manual/mobile-header-swipe-row.jpg" alt="The phone header with the row of links you can swipe" width="300">

**Signed in on a phone**, the account button is only the round avatar with your initials. There is no name and no logout icon in the bar.

<img src="../apps/web/public/manual/mobile-header-avatar.jpg" alt="The phone header when signed in, showing only the avatar" width="300">

**Tap the avatar** and a profile sheet opens. It shows your name, email, mobile number, role, a link to your home area and the **Sign out** button. The same avatar and profile sheet are used in the traveller pages, the partner portal and the admin console on a phone.

<img src="../apps/web/public/manual/mobile-profile.png" alt="The profile sheet with name, email, role and the sign out button" width="300">

---

## 4. The user flow, step by step

### 4.1 Traveller flow

| Step | What the traveller does | Screen |
|---|---|---|
| 1 | Opens the site and searches (town, kind of service, dates, guests) | Landing page `/` |
| 2 | Looks at the results, filters and sorts them | Explore `/explore` |
| 3 | Opens a listing and reads the details | Listing page `/services/...` |
| 4 | Chooses a date, seats, room, vehicle or route and sees the full price | Booking panel on the listing page |
| 5 | Signs in (mobile code, or email and password) | Sign in `/sign-in` |
| 6 | Books now, or sends a request if the partner must confirm first | Booking panel |
| 7 | Pays while the seats are held | Checkout `/checkout/...` |
| 8 | Sees the booking with its status and timeline | My Trips `/trips` |
| 9 | Can cancel and see the refund first | Booking page `/trips/...` |
| 10 | Can write a review after the trip is completed | Booking page `/trips/...` |

### 4.2 Partner flow

| Step | What the partner does | Screen |
|---|---|---|
| 1 | Reads how partnering works | Become a partner `/partner/join` |
| 2 | Registers in seven steps | Register `/partner/register` |
| 3 | Follows the application until it is approved | Partner dashboard `/partner` |
| 4 | Sees the listings and how they are doing | Listings `/partner/listings` |
| 5 | Accepts or declines requests, marks bookings started or completed | Bookings `/partner/bookings` |
| 6 | Sees earnings, commission and payouts | Finance `/partner/finance` |

### 4.3 Team (admin) flow

| Step | What the team does | Screen |
|---|---|---|
| 1 | Looks at the live numbers | Overview `/admin` |
| 2 | Checks each partner application and its documents | Provider applications `/admin/providers` |
| 3 | Publishes, pauses or rejects listings | Listings `/admin/listings` |
| 4 | Takes a town live or offline | Destinations `/admin/destinations` |
| 5 | Watches users, bookings and money | Users, Bookings, Finance |
| 6 | Reads support tickets | Support `/admin/support` |

---

## 5. Traveller features

### 5.1 Search and results

One search bar for everything: town, kind of service, dates and guests. The results page has filters (town, type, price, rating) and sorting (recommended, price, rating). A badge on each card says if the listing confirms at once or if the partner confirms first.

![Search results for Gokarna](../apps/web/public/manual/explore.jpg)

### 5.2 Destinations

A page with the four launch towns, and a guide page for each town. The guide has an overview, places to visit, listings in that town by kind of service, trip plans from the blog, travel tips and common questions.

![The four launch destinations](../apps/web/public/manual/destinations.jpg)

![The guide page for Gokarna](../apps/web/public/manual/destination-detail.jpg)

### 5.3 Category pages

Each kind of service has its own page: Stays, Boating, Rentals, Cabs and transport, Guides, Experiences and Packages. The page groups the listings by town.

![The Boating page](../apps/web/public/manual/category-boating.jpg)

### 5.4 Blog: trip plans and sightseeing

The blog (`/blog`) has four articles written for travellers:

| Article | What it is |
|---|---|
| One day in Gokarna | A 1-day trip, from the temple town in the morning to the sunset at Kudle Beach |
| Seven days down the coast | A 7-day plan from Karwar to Udupi, day by day |
| Sightseeing on the coast | Twelve places worth a stop: temples, beaches, islands, a fort and the Yana rocks |
| Uttara Kannada trip plans | Three plans for the district: 2 days, 4 days and 6 days |

Each article shows the plan as steps on a dotted trail, with a link to the guide of each town. Near the end there are four common questions with short answers. A box on the side links to the town guides and to the kinds of service you may want to book. The articles give no prices, distances or opening hours, so nothing in them can go out of date quickly.

![The blog page with four articles](../apps/web/public/manual/blog-index.jpg)

![A blog article: the 7-day plan](../apps/web/public/manual/blog-article.jpg)

<img src="../apps/web/public/manual/mobile-blog-article.jpg" alt="A blog article on a phone" width="300">

### 5.5 Listing page

A listing page shows photos, a short summary, highlights, what is included, safety notes, where to go, the partner (with a "verified" mark), the cancellation policy and reviews.

![A listing page for a boat ride](../apps/web/public/manual/listing-detail.jpg)

### 5.6 Booking panel and full price

The booking panel changes with the kind of service:

- boat rides and activities: a date and a departure time, with seats left
- stays: a room type, check-in and check-out, number of rooms
- rentals: a vehicle, pickup and return date and time
- cabs: a route, a date and a pickup time
- guides: a date and a start time

Dates are chosen in the site's own calendar and the other choices in its own list. A room type, vehicle or route shows its price on the right of its row.

After you choose, the panel shows the price line by line (base price, tax, fees, deposit) and the total. You can enter a coupon code. The button says **Book now** or **Request booking**.

![The booking panel showing the full price](../apps/web/public/manual/listing-price-quote.jpg)

### 5.7 Sign in

Two ways to sign in: a one-time code sent to your mobile number, or email and password. After sign-in the app sends you to the right place: travellers to My Trips, partners to the partner portal, team members to the admin console.

![The sign-in page](../apps/web/public/manual/sign-in.jpg)

### 5.8 Checkout

Checkout shows the booking, the price lines and a countdown. Your seats or rooms are held only for that time. In this version the payment step is a **test simulator**: you can press "simulate success" or "simulate failure". No real money is charged.

![Checkout with the hold countdown and the payment simulator](../apps/web/public/manual/checkout.png)

### 5.9 My Trips

All bookings in three tabs: Upcoming, Past and Cancelled. Each row shows the status, for example Confirmed, Awaiting partner, Awaiting payment or In progress.

![My Trips](../apps/web/public/manual/trips.png)

### 5.10 Booking page

One booking in detail: the itinerary, the price lines, the partner and a timeline of everything that happened to the booking.

![A booking page with its timeline](../apps/web/public/manual/trip-detail.png)

### 5.11 Cancel with a clear refund

When you press "Cancel booking", the app first shows how much money you get back under the cancellation policy. You confirm only after you see it.

![The cancel window showing the refund](../apps/web/public/manual/trip-cancel-refund.png)

### 5.12 Reviews

After a booking is completed, the traveller can give stars and write a review on the booking page. Only travellers with a completed booking can review.

![The review box on a completed booking](../apps/web/public/manual/trip-review.png)

### 5.13 On a phone

The traveller screens work on a phone. My Trips has a navigation bar at the bottom.

<img src="../apps/web/public/manual/mobile-listing.jpg" alt="A listing page on a phone" width="300"> <img src="../apps/web/public/manual/mobile-trips.png" alt="My Trips on a phone" width="300">

---

## 6. Partner features

### 6.1 Become a partner

A page that explains how partnering works and who can join.

![The Become a partner page](../apps/web/public/manual/partner-join.jpg)

### 6.2 Register your business

A form with seven steps: Account, Verify (mobile code), Business, Services, Location, Documents (a list of what you will need) and Submit.

![The first step of partner registration](../apps/web/public/manual/partner-register.png)

### 6.3 Partner dashboard

The dashboard shows the status of the business (for example Approved), six numbers (bookings today, upcoming bookings, requests waiting, earnings this month, listing views, rating), the documents needed, the services and locations, and the history of the application.

![The partner dashboard](../apps/web/public/manual/partner-dashboard.png)

### 6.4 Listings

Each listing with its price, views, bookings and whether it confirms instantly.

![The partner listings page](../apps/web/public/manual/partner-listings.png)

### 6.5 Booking requests

Some listings need the partner to say yes first. These requests appear in the Requests tab, where the partner can accept or decline.

![Booking requests waiting for the partner](../apps/web/public/manual/partner-requests.png)

### 6.6 Bookings

Upcoming and past bookings with the guest, the service, the time, the total and the partner's payout. The partner can mark a booking started or completed, or cancel it with a reason.

![The partner bookings page](../apps/web/public/manual/partner-bookings.png)

### 6.7 Finance

Gross service value, commission and tax, refund adjustments, net earnings, money waiting for settlement and money paid out. Below that is a table of recent bookings and a list of payouts.

![The partner finance page](../apps/web/public/manual/partner-finance.png)

### 6.8 Staff roles

A partner can have staff with smaller roles. For example, a front-desk account can manage bookings but cannot see finance. (Inviting staff from the portal is not built yet; see section 9.)

---

## 7. Team (admin) features

### 7.1 Overview

Live numbers for the whole marketplace: users, partners, applications, destinations, services, bookings, booking value, platform revenue and refunds.

![The admin overview](../apps/web/public/manual/admin-overview.png)

### 7.2 Partner applications and review

A list of partner applications with tabs by status. Opening one shows the business, the owner, the documents against what is required, the decisions the team can take and the history.

![The list of partner applications](../apps/web/public/manual/admin-providers.png)

![The review page for one partner](../apps/web/public/manual/admin-provider-review.png)

### 7.3 Destinations

For each town: its status, partner applications, approved partners, live listings, a switch to feature it on the homepage and a button to take it offline.

![The admin destinations page](../apps/web/public/manual/admin-destinations.png)

### 7.4 Listings

Every listing with its partner, category, town, price and status. The team can publish, approve, pause, request changes or reject.

![The admin listings page](../apps/web/public/manual/admin-listings.png)

### 7.5 Users

Search people by name, email or phone. Filter by role.

![The admin users page](../apps/web/public/manual/admin-users.png)

### 7.6 Bookings

Every booking across all partners with its status.

![The admin bookings page](../apps/web/public/manual/admin-bookings.png)

### 7.7 Finance

Booking value, commission, tax, fees, partner earnings, refunds and payouts. One table splits the numbers by category and another lists partner payouts.

![The admin finance page](../apps/web/public/manual/admin-finance.png)

### 7.8 Support

A list of support tickets. A ticket shows the messages, internal notes, the person who asked, the linked booking and, for a safety problem, the details of the incident.

![The list of support tickets](../apps/web/public/manual/admin-support.png)

![One support ticket about a safety incident](../apps/web/public/manual/admin-support-ticket.png)

### 7.9 Separate admin roles

There are admin roles for operations, verification, finance and support. Each role sees only its own area. A super admin sees everything.

### 7.10 Design system page

`/design-system` is an internal page that shows every colour, text style and component used in the app.

![The design system page](../apps/web/public/manual/design-system.jpg)

---

## 8. Search engines (SEO)

SEO means helping search engines such as Google understand each page, so the right page can show up when people search. These things are now in the site:

| What | Where | Why it helps |
|---|---|---|
| A clear title and description on every public page | Home, towns, categories, blog, listings, manual | This is the text people see in search results |
| Keywords chosen from real searches | `apps/web/src/config/seo.ts` and each blog article | The pages use the same words people type |
| One correct address for each page (canonical) | Every public page | Search engines do not treat a page as a copy of another |
| Sharing picture and site name | Every public page | Links shared on WhatsApp or social media show a picture |
| Extra page data for search engines | Home, towns, categories, blog | Search results can show breadcrumbs and questions |
| Common questions with answers | Town guides and blog articles | These match the questions people ask |
| Site map and robots file | `/sitemap.xml`, `/robots.txt` | Search engines find every public page, including each listing and blog article, and skip private ones |
| Site icon | Browser tab and search results | The site is easier to recognise |

**Keywords used**

| Page | Main search words |
|---|---|
| Home | coastal Karnataka trip, Gokarna trip, Murudeshwar trip, Karwar tourism, Udupi tourism, Uttara Kannada tourist places |
| Gokarna | places to visit in Gokarna, things to do in Gokarna, Om Beach, Kudle Beach, Gokarna beach trek, Gokarna homestay |
| Murudeshwar | places to visit in Murudeshwar, Murudeshwar Temple, Netrani Island snorkelling, hotels in Murudeshwar |
| Karwar | places to visit in Karwar, things to do in Karwar, Rabindranath Tagore Beach, Kali river, Sadashivgad Fort |
| Udupi | places to visit in Udupi, Sri Krishna Matha, Malpe Beach, St Mary's Island boat |
| Stays, boating, rentals, cabs, guides, experiences, packages | for example Gokarna homestay, boat ride in Gokarna, scooty rental in Gokarna, Gokarna taxi, Udupi temple guide, kayaking in Karwar |
| Blog: 1-day trip | Gokarna 1 day itinerary, one day trip to Gokarna, Kudle Beach to Om Beach |
| Blog: 7-day plan | coastal Karnataka itinerary, coastal Karnataka road trip, Karwar to Udupi road trip |
| Blog: sightseeing | places to visit in coastal Karnataka, St Mary's Island, Mirjan Fort, Yana rocks |
| Blog: Uttara Kannada | Uttara Kannada tourist places, Uttara Kannada itinerary, North Canara travel guide |

**Good to know**

- Keywords alone do not put a site at the top. Search engines mostly read the titles, the descriptions and the text on the page. They also look at how many other sites link to yours, and that takes time.
- The site must run on its real web address first. Set `NEXT_PUBLIC_SITE_URL` to that address, because the page addresses, the site map and the sharing pictures all use it.
- After launch, add the site to Google Search Console and send it `/sitemap.xml`.
- New blog articles are the best way to be found for more searches.

---

## 9. What is not built yet

These things are planned but not in the app today. The landing page does not claim them.

| Not built yet | What you see instead |
|---|---|
| Real payment gateway (Razorpay) | A test payment simulator at checkout |
| Document upload by partners | The storage and the upload rules are built in the API, but there is no upload screen yet. The dashboard lists the documents needed; demo documents are loaded by the seed script |
| Partners creating and editing their own listings | The Listings page says the team sets listings up for now |
| Booking several services in one checkout | Each booking is paid on its own |
| Inviting staff from the partner portal | Menu item shown as "Phase 3" |
| Partner support tickets | Menu item shown as "Phase 7" |
| Replying to tickets and changing their status | Tickets can be read only |
| Interactive map | A placeholder that says the map is not set up |
| Saved places and the account page | Empty placeholder pages |
| Writing blog articles in an admin screen | The four articles are written in a code file (`apps/web/src/content/blog.ts`) |
| Price and rating shown in search results for a listing | Listing pages have a title, description and picture for search, but not this extra data yet |
| Notifications in the app, password reset screen | Emails and SMS about bookings and partner applications are sent when the AWS sender is switched on (on a developer's computer they only go to the log). A list of notifications inside the app, and the password reset screen, are not built |
| Admin settings (commission rules, tax rules) | Menu item shown as "Phase 8" |

The full plan and progress list is in [14-roadmap.md](14-roadmap.md).

---

<!-- manual:public-end (everything below is for developers and is not shown on the public /user-manual page) -->

## 10. How to run the app and remake the screenshots

Short version (the full steps are in the [README](../README.md)):

```bash
pnpm install
pnpm db:up            # starts PostgreSQL, Redis, S3Mock and Mailpit in Docker
pnpm --filter @kt/domain build
pnpm --filter @kt/api build
pnpm --filter @kt/api exec prisma migrate deploy
pnpm db:seed
pnpm db:seed:demo     # loads the demo data shown in these screenshots
pnpm dev:api          # API on http://localhost:4000
pnpm dev:web          # website on http://localhost:3000
```

Demo accounts for every role are listed in [15-demo-data.md](15-demo-data.md).

The screenshots are in `apps/web/public/manual/`, so the website can show them on the public manual page. They were taken on 12 November 2026 from the app running on a local computer with the demo data, using Playwright with the Edge browser. Desktop pictures are 1440 pixels wide. Phone pictures are 390 pixels wide. Very long pages are cut off at the bottom.
