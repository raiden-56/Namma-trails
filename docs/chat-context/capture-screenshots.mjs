// Captures documentation screenshots of the running app (web :3000, API :4000, demo data loaded).
// Usage: node capture.mjs [group ...]   groups: public traveller partner admin landing
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("C:/practise-folder/all-in-one/apps/web/package.json");
const { chromium } = require("@playwright/test");

const envFile = fs.readFileSync("C:/practise-folder/all-in-one/apps/web/.env.local", "utf8");
const WEB = (process.env.CAPTURE_WEB ?? /NEXT_PUBLIC_SITE_URL=(\S+)/.exec(envFile)?.[1] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = "C:/practise-folder/all-in-one/apps/web/public/manual";
// The demo password is read from the project's own demo guide, never typed here.
const DEMO_DOC = fs.readFileSync("C:/practise-folder/all-in-one/docs/15-demo-data.md", "utf8");
const PASSWORD = /Password for every demo account: `([^`]+)`/.exec(DEMO_DOC)[1];
const groups = process.argv.slice(2);
const want = (g) => groups.length === 0 || groups.includes(g);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const results = [];

async function newPage({ width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/status of 401|status of 404/.test(m.text())) page.errors.push(m.text().slice(0, 300));
  });
  return page;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Hide the Next.js dev badge and walk the page so lazy images and scroll reveals render.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() =>
    Promise.race([
      Promise.all([...document.images].filter((i) => !i.complete && i.offsetParent !== null).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
      new Promise((r) => setTimeout(r, 5000)),
    ]),
  );
  await page.waitForTimeout(900);
}

async function shoot(page, name, { full = true, maxH = 2400 } = {}) {
  const file = `${OUT}/${name}`;
  const type = name.endsWith(".jpg") ? "jpeg" : "png";
  const dims = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  const opts = { path: file, type, ...(type === "jpeg" ? { quality: 86 } : {}) };
  if (full) {
    opts.fullPage = true;
    if (dims.h > maxH) opts.clip = { x: 0, y: 0, width: dims.w, height: maxH };
  }
  await page.screenshot(opts);
  results.push({ name, url: page.url().replace(WEB, ""), pageH: dims.h, overflowX: dims.sw > dims.w, kb: Math.round(fs.statSync(file).size / 1024), errors: page.errors.splice(0) });
}

async function shootElement(page, selector, name, cropH = 0) {
  try {
    const el = page.locator(selector).first();
    await page.addStyleTag({ content: "header.sticky{visibility:hidden!important}" });
    if (cropH) await el.evaluate((node) => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY, behavior: "instant" }));
    else await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(cropH ? 1500 : 700);
    const file = `${OUT}/${name}`;
    const type = name.endsWith(".jpg") ? "jpeg" : "png";
    const quality = type === "jpeg" ? { quality: 86 } : {};
    if (cropH) {
      const box = await el.evaluate((node) => { const r = node.getBoundingClientRect(); return { x: 0, y: r.top + window.scrollY, width: document.documentElement.clientWidth, height: r.height }; });
      await page.screenshot({ path: file, type, ...quality, fullPage: true, clip: { ...box, height: Math.min(box.height, cropH) } });
    } else {
      await el.screenshot({ path: file, type, ...quality });
    }
    results.push({ name, url: page.url().replace(WEB, ""), kb: Math.round(fs.statSync(file).size / 1024), errors: page.errors.splice(0) });
  } catch (e) {
    results.push({ name, failed: String(e).slice(0, 400) });
  }
}

async function visit(page, path, name, opts = {}) {
  try {
    await page.goto(`${WEB}${path}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    if (opts.before) await opts.before(page);
    await shoot(page, name, opts);
  } catch (e) {
    results.push({ name, failed: String(e).slice(0, 400) });
  }
}

/** Chooses the day that is `days` from today (India time) in the open calendar. */
async function pickDay(page, days) {
  const date = new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
  await page.locator('[role="dialog"][popover]').waitFor();
  for (let month = 0; month < 12; month++) {
    const day = page.locator(`[data-date="${date}"]`);
    if (await day.count()) return day.click();
    await page.getByRole("button", { name: "Next month" }).click();
  }
  throw new Error("The calendar never reached " + date);
}

async function signIn(page, email) {
  await page.goto(`${WEB}/sign-in`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Email" }).click();
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

if (want("public")) {
  const page = await newPage();
  await visit(page, "/destinations", "destinations.jpg", { maxH: 1900 });
  await visit(page, "/destinations/gokarna", "destination-detail.jpg", { maxH: 2600 });
  await visit(page, "/explore?destination=gokarna", "explore.jpg", { maxH: 1700 });
  await visit(page, "/boating", "category-boating.jpg", { maxH: 1800 });
  await visit(page, "/services/omcoast-sunset", "listing-detail.jpg", { maxH: 2600 });
  await visit(page, "/services/omcoast-sunset", "listing-price-quote.jpg", {
    maxH: 1250,
    before: async (p) => {
      await p.locator('input[name="slot"]:not([disabled])').first().check({ force: true });
      await p.getByText(/Total/).first().waitFor({ timeout: 15000 });
      await p.waitForTimeout(500);
    },
  });
  await visit(page, "/sign-in", "sign-in.jpg", { full: false });
  await visit(page, "/blog", "blog-index.jpg", { maxH: 1800 });
  await visit(page, "/blog/seven-days-karwar-to-udupi", "blog-article.jpg", { maxH: 3000 });
  await visit(page, "/design-system", "design-system.jpg", { maxH: 2000 });
  await visit(page, "/partner/join", "partner-join.jpg", { maxH: 2500 });
  await visit(page, "/partner/register", "partner-register.png", { maxH: 1500 });
  await page.context().close();
}

if (want("traveller")) {
  const page = await newPage();
  try {
    await signIn(page, "asha@demo.example.com");
    await visit(page, "/trips", "trips.png", { maxH: 1600 });
    const confirmed = page.locator('[data-testid="trip-row"]').filter({ hasText: "Confirmed" }).filter({ hasText: "boat ride" }).first();
    const href = await confirmed.locator('a[href^="/trips/"]').first().getAttribute("href");
    const pay = await page.locator('a[href^="/checkout/"]').first().getAttribute("href").catch(() => null);
    if (href) {
      await visit(page, href, "trip-detail.png", { maxH: 2200 });
      await visit(page, href, "trip-cancel-refund.png", {
        full: false,
        before: async (p) => {
          await p.getByRole("button", { name: "Cancel booking" }).first().click();
          await p.locator('[data-testid="refund-preview"]').waitFor({ timeout: 10000 });
          await p.waitForTimeout(500);
        },
      });
    }
    if (pay) await visit(page, pay, "checkout.png", { full: false });
    await page.goto(`${WEB}/trips`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /Past/ }).click();
    const pastLinks = await page.locator('[data-testid="trip-row"] a[href^="/trips/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    let reviewShot = false;
    for (const link of pastLinks) {
      await page.goto(`${WEB}${link}`, { waitUntil: "networkidle" });
      if (await page.getByText("How was it?").count()) {
        await visit(page, link, "trip-review.png", { maxH: 1700 });
        reviewShot = true;
        break;
      }
    }
    if (!reviewShot) results.push({ name: "trip-review.png", failed: "no completed booking without a review for this account" });
    else results.push({ name: "checkout.png", failed: "no booking awaiting payment for this account" });
    const phone = await newPage({ width: 390, height: 844, mobile: true });
    await signIn(phone, "priya@demo.example.com");
    await visit(phone, "/trips", "mobile-trips.png", { full: false });
    await phone.context().close();
  } catch (e) {
    results.push({ name: "traveller", failed: String(e).slice(0, 400) });
  }
  await page.context().close();
}

if (want("partner")) {
  const page = await newPage();
  try {
    await signIn(page, "ravi@demo.example.com");
    await visit(page, "/partner", "partner-dashboard.png", { maxH: 2200 });
    await visit(page, "/partner/listings", "partner-listings.png", { maxH: 1600 });
    await visit(page, "/partner/bookings", "partner-bookings.png", { maxH: 1700 });
    await visit(page, "/partner/finance", "partner-finance.png", { maxH: 1900 });
    await page.context().clearCookies();
    await signIn(page, "sudha@demo.example.com");
    await visit(page, "/partner/bookings?view=requests", "partner-requests.png", { maxH: 1500 });
  } catch (e) {
    results.push({ name: "partner", failed: String(e).slice(0, 400) });
  }
  await page.context().close();
}

if (want("admin")) {
  const page = await newPage();
  try {
    await signIn(page, "superadmin@demo.example.com");
    await visit(page, "/admin", "admin-overview.png", { maxH: 1900 });
    await visit(page, "/admin/providers?tab=all", "admin-providers.png", { maxH: 1600 });
    const review = await page.locator('a[href^="/admin/providers/"]').first().getAttribute("href").catch(() => null);
    const cottages = await page.locator('a[href^="/admin/providers/"]', { hasText: /Karwar Beach Cottages|Udupi Self Drive/ }).first().getAttribute("href").catch(() => null);
    if (cottages ?? review) await visit(page, cottages ?? review, "admin-provider-review.png", { maxH: 2400 });
    await visit(page, "/admin/destinations", "admin-destinations.png", { maxH: 1700 });
    await visit(page, "/admin/listings", "admin-listings.png", { maxH: 1700 });
    await visit(page, "/admin/users", "admin-users.png", { maxH: 1700 });
    await visit(page, "/admin/bookings", "admin-bookings.png", { maxH: 1700 });
    await visit(page, "/admin/finance", "admin-finance.png", { maxH: 1900 });
    await visit(page, "/admin/support", "admin-support.png", { maxH: 1600 });
    const ticket = await page.locator('a[href^="/admin/support/"]').first().getAttribute("href").catch(() => null);
    if (ticket) await visit(page, ticket, "admin-support-ticket.png", { maxH: 1900 });
  } catch (e) {
    results.push({ name: "admin", failed: String(e).slice(0, 400) });
  }
  await page.context().close();
}

if (want("landing")) {
  const desktop = await newPage();
  await visit(desktop, "/", "landing-desktop.jpg", { maxH: 20000 });
  await visit(desktop, "/", "landing-hero.jpg", { full: false });
  await shootElement(desktop, "#how-it-works", "landing-flow-traveller.png");
  await desktop.getByRole("tab", { name: "Local partners" }).click().catch((e) => results.push({ name: "tab partners", failed: String(e).slice(0, 200) }));
  await shootElement(desktop, "#how-it-works", "landing-flow-partner.png");
  await desktop.getByRole("tab", { name: "Our team" }).click().catch((e) => results.push({ name: "tab team", failed: String(e).slice(0, 200) }));
  await shootElement(desktop, "#how-it-works", "landing-flow-team.png");
  await shootElement(desktop, 'section[aria-labelledby="destinations-title"]', "landing-destinations.jpg", 640);
  await desktop.locator('section[aria-labelledby="categories-title"] li').nth(1).hover().catch(() => {});
  await shootElement(desktop, 'section[aria-labelledby="blog-title"]', "landing-blog.jpg");
  await shootElement(desktop, 'section[aria-labelledby="categories-title"]', "landing-categories.jpg");
  await shootElement(desktop, 'section[aria-labelledby="live-title"]', "landing-live-listings.jpg");
  await shootElement(desktop, 'section[aria-labelledby="features-title"]', "landing-features.png");
  await shootElement(desktop, 'section[aria-labelledby="why-title"]', "landing-trust.png");
  await shootElement(desktop, 'section[aria-labelledby="partner-cta-title"]', "landing-partner.jpg");
  await visit(desktop, "/", "search-calendar.jpg", {
    full: false,
    before: async (p) => {
      const form = p.locator('form[role="search"]').first();
      await form.getByRole("combobox", { name: "Where" }).click();
      await p.locator('[role="option"][data-value="gokarna"]').click();
      await form.getByRole("button", { name: /^From/ }).click();
      await pickDay(p, 6);
      await form.getByRole("button", { name: /^To/ }).click();
      await pickDay(p, 10);
      await form.getByRole("button", { name: /^To/ }).click();
      await p.waitForTimeout(600);
    },
  });
  await visit(desktop, "/", "back-to-top.jpg", {
    full: false,
    before: async (p) => {
      await p.evaluate(() => {
        const part = document.querySelector('section[aria-labelledby="blog-title"]');
        window.scrollTo({ top: (part?.getBoundingClientRect().top ?? 1600) + window.scrollY - 64, behavior: "instant" });
      });
      await p.waitForTimeout(1200);
    },
  });
  await visit(desktop, "/stays", "header-desktop.jpg", { full: false });
  await desktop.context().close();
  const phone = await newPage({ width: 390, height: 844, mobile: true });
  await visit(phone, "/", "landing-mobile.jpg", { maxH: 30000 });
  await visit(phone, "/", "landing-mobile-hero.jpg", { full: false });
  await visit(phone, "/", "mobile-search-dropdown.jpg", {
    full: false,
    before: async (p) => {
      await p.getByRole("button", { name: /Where are you headed/ }).tap();
      const sheet = p.getByRole("dialog", { name: "Plan your trip" });
      await sheet.waitFor();
      await p.waitForTimeout(900);
      await sheet.getByRole("combobox", { name: "Where" }).tap();
      await p.waitForTimeout(600);
    },
  });
  await visit(phone, "/services/omcoast-sunset", "mobile-listing.jpg", { maxH: 2600 });
  await visit(phone, "/experiences", "mobile-header-swipe-row.jpg", { full: false });
  await visit(phone, "/blog/one-day-in-gokarna", "mobile-blog-article.jpg", { maxH: 2600 });
  try {
    await signIn(phone, "asha@demo.example.com");
    await visit(phone, "/", "mobile-header-avatar.jpg", { full: false });
    await visit(phone, "/", "mobile-profile.png", {
      full: false,
      before: async (p) => {
        await p.getByTestId("profile-trigger").click();
        await p.getByTestId("profile-sheet").waitFor();
        await p.waitForTimeout(900);
      },
    });
  } catch (e) {
    results.push({ name: "mobile-profile", failed: String(e).slice(0, 400) });
  }
  await phone.context().close();
}

await browser.close();
console.log(JSON.stringify(results, null, 1));
