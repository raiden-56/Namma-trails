import { expect, test, type Page } from "@playwright/test";
import { pickDate, snapshot } from "./support";

/**
 * Booking journeys against the demo data (pnpm db:seed:demo). Payments use the
 * development-only payment simulator; nothing real is charged.
 */
test.describe.configure({ mode: "serial" });

const PASSWORD = "NammaDemo2026";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByRole("tab", { name: "Email" }).click();
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** An IST calendar date `days` from today. */
function istDate(days: number) {
  return new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

test("a traveller books a kayaking session, pays, and cancels with a policy refund", async ({ page }, testInfo) => {
  await signIn(page, "arjun@demo.example.com");
  await page.goto("/services/kali-morning");
  await expect(page.getByRole("heading", { name: "Morning kayaking on the Kali river", level: 1 })).toBeVisible();

  await pickDate(page, page.getByLabel("Date", { exact: true }), istDate(10));
  const slot = page.locator('input[name="slot"]:not([disabled])').first();
  await expect(slot).toBeAttached();
  await slot.check({ force: true }); // visually hidden radio inside a styled label
  await expect(page.getByText(/Total/).first()).toBeVisible();
  await snapshot(page, testInfo, "listing-with-quote");

  await page.getByRole("button", { name: "Book now" }).click();
  await expect(page).toHaveURL(/\/checkout\/BK-[A-Z0-9]{8}$/);
  const reference = page.url().split("/").pop()!;
  await expect(page.getByText(/no real money/i)).toBeVisible();
  await page.getByRole("button", { name: /simulate success/ }).click();

  await expect(page).toHaveURL(new RegExp(`/trips/${reference}$`));
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await snapshot(page, testInfo, "trip-confirmed");

  // Cancel 10 days ahead → full refund of the service under the Moderate policy.
  await page.getByRole("button", { name: "Cancel booking" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(/refund/i);
  await dialog.getByLabel("Reason").fill("Change of plans (automated test)");
  await dialog.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText(/Refunded|Partially refunded/).first()).toBeVisible();
  await snapshot(page, testInfo, "trip-refunded");
});

test("a request-to-book guide walk is accepted by the partner, then paid by the traveller", async ({ page }, testInfo) => {
  await signIn(page, "meera@demo.example.com");
  await page.goto("/services/heritage-walk");
  await expect(page.getByText("Partner confirms").first()).toBeVisible();
  // A different day per run: each pending request holds a guide until the partner answers.
  await pickDate(page, page.getByLabel("Date", { exact: true }), istDate(3 + (Math.floor(Date.now() / 60_000) % 25)));
  await page.getByRole("button", { name: "Request booking" }).click();
  await expect(page).toHaveURL(/\/trips\/BK-[A-Z0-9]{8}/);
  const reference = page.url().match(/BK-[A-Z0-9]{8}/)![0];
  await expect(page.getByText(/Awaiting partner/i).first()).toBeVisible();

  // The partner accepts the request.
  await signIn(page, "sudha@demo.example.com");
  await page.goto("/partner/bookings");
  await page.getByRole("navigation", { name: "Booking views" }).getByRole("link", { name: "Requests" }).click();
  await expect(page).toHaveURL(/view=requests/);
  const row = page.getByRole("row").filter({ hasText: reference });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Accept" }).click(); // confirmation explains the guest will be asked to pay
  await expect(page.getByRole("row").filter({ hasText: reference })).toHaveCount(0);
  await snapshot(page, testInfo, "partner-accepted");

  // The traveller now pays to confirm.
  await signIn(page, "meera@demo.example.com");
  await page.goto(`/trips/${reference}`);
  await page.getByRole("link", { name: "Complete payment" }).or(page.getByRole("button", { name: "Complete payment" })).first().click();
  await expect(page).toHaveURL(new RegExp(`/checkout/${reference}$`));
  await page.getByRole("button", { name: /simulate success/ }).click();
  await expect(page).toHaveURL(new RegExp(`/trips/${reference}$`));
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

test("partners, finance and support each see their own operational views", async ({ page }) => {
  await signIn(page, "nagesh@demo.example.com");
  await page.goto("/partner/finance");
  await expect(page.getByText(/Net earnings/i).first()).toBeVisible();

  await signIn(page, "finance@demo.example.com");
  await page.goto("/admin/finance");
  await expect(page.getByText(/Gross booking value/i).first()).toBeVisible();
  await page.goto("/admin/support");
  await expect(page.getByText(/super admin/i).first()).toBeVisible(); // friendly denial: finance can't read tickets

  await signIn(page, "support@demo.example.com");
  await page.goto("/admin/support");
  await expect(page.getByText("Boat had too few life jackets on our ride").first()).toBeVisible();
});
