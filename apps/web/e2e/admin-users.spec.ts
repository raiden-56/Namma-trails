import { expect, test } from "@playwright/test";
import { chooseOption, readOtp, snapshot, uniquePhone } from "./support";

/**
 * Complete flow: real users are created through the UI, then the super admin
 * finds them in the admin Users view. Every run uses fresh phone numbers.
 */
test.describe.configure({ mode: "serial" });

const runId = Date.now().toString().slice(-6);
const traveller = { phone: uniquePhone() };
const partner = {
  phone: uniquePhone(),
  name: `E2E Partner ${runId}`,
  email: `e2e.partner.${runId}@example.com`,
  business: `E2E Cove Stays ${runId}`,
  password: "CoastStay2026",
};

test("1. a traveller signs up with a mobile OTP and cannot open the admin dashboard", async ({ page, request }, testInfo) => {
  await page.goto("/sign-in");
  await page.locator("#signin-phone").fill(traveller.phone);
  const sentAfter = Date.now();
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator("#signin-code")).toBeVisible();

  const code = await readOtp(request, traveller.phone, sentAfter);
  await page.locator("#signin-code").fill(code);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/trips$/);

  // Full page load: the session is restored from the httpOnly refresh cookie, and the API answers 403.
  await page.goto("/admin");
  await expect(page.getByRole("alert").filter({ hasText: "You don't have access to the admin dashboard" })).toBeVisible();
  await snapshot(page, testInfo, "traveller-blocked-from-admin");
});

test("2. a partner registers a business through the 7-step wizard", async ({ page, request }, testInfo) => {
  await page.goto("/partner/register");
  await page.locator("#fullName").fill(partner.name);
  await page.locator("#email").fill(partner.email);
  await page.locator("#phone").fill(partner.phone);
  await page.locator("#password").fill(partner.password);
  await page.locator("#confirmPassword").fill(partner.password);
  await page.getByLabel(/I accept the partner agreement/).check();
  await page.getByRole("button", { name: "Continue" }).click();

  const sentAfter = Date.now();
  await page.getByRole("button", { name: "Send code" }).click();
  await page.locator("#otpCode").fill(await readOtp(request, partner.phone, sentAfter));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("is verified and your account is ready")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator("#businessName").fill(partner.business);
  await chooseOption(page, page.locator("#businessType"), "homestay");
  await page.locator("#description").fill("Sea-facing homestay with four rooms, home-cooked coastal meals and bicycles for guests.");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator('input[value="stay"]').check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator("#addressLine").fill("Main Beach Road");
  await page.locator("#city").fill("Gokarna");
  await page.locator("#district").fill("Uttara Kannada");
  await page.locator("#pincode").fill("581326");
  await page.locator('input[value="gokarna"]').check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/I have these documents ready/).check();
  await page.getByRole("button", { name: "Continue" }).click();

  // The review step must wait for the user (regression: it used to auto-submit).
  await expect(page.getByRole("heading", { name: "Review and submit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit application" })).toBeEnabled();
  await expect(page.getByText(partner.business)).toBeVisible();
  await page.getByRole("button", { name: "Submit application" }).click();

  await expect(page.getByRole("heading", { name: "Application saved" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: partner.business })).toContainText("draft");
  await snapshot(page, testInfo, "partner-application-saved");
});

test("2b. the partner signs in with email and sees their application dashboard", async ({ page }, testInfo) => {
  await page.goto("/sign-in?as=partner");
  await page.getByRole("tab", { name: "Email" }).click();
  await page.locator("#signin-email").fill(partner.email);
  await page.locator("#signin-password").fill(partner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/partner$/);
  await expect(page.getByRole("heading", { name: partner.business })).toBeVisible();
  await expect(page.getByTestId("portal-identity")).toContainText(partner.name);
  await expect(page.getByTestId("partner-next-step")).toContainText("Finish your application");
  await expect(page.getByText("Owner identity proof")).toBeVisible();
  await expect(page.getByText("Awaiting verification")).toBeVisible();
  await expect(page.getByText("Application started")).toBeVisible();
  // Unbuilt sections (e.g. document upload) are disabled with a reason, never dead links.
  await expect(page.getByText(/Phase \d/).first()).toBeVisible();
  await snapshot(page, testInfo, "partner-dashboard");
});

test("3. admin pages send signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fusers$/);
});

test("4. the super admin sees the new users", async ({ page }, testInfo) => {
  const email = process.env.E2E_ADMIN_EMAIL!;
  const password = process.env.E2E_ADMIN_PASSWORD!;

  await page.goto("/sign-in?next=%2Fadmin%2Fusers");
  await page.getByRole("tab", { name: "Email" }).click();
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Returns to the page that was asked for.
  await expect(page).toHaveURL(/\/admin\/users$/);
  const identity = page.getByTestId("admin-identity");
  await expect(identity).toContainText("E2E Super Admin");
  await expect(identity).toContainText("super admin");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  await expect(page.getByTestId("users-total")).toHaveText(/\d+ users?/);
  await snapshot(page, testInfo, "admin-users-all");

  const search = page.getByRole("searchbox", { name: "Search" });

  // The partner: found by phone, shown with their business and its verification status.
  await search.fill(partner.phone);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${partner.phone}`));
  const partnerRow = page.getByRole("row").filter({ hasText: partner.name });
  await expect(partnerRow).toHaveCount(1);
  await expect(partnerRow).toContainText(`+91${partner.phone}`);
  await expect(partnerRow).toContainText(partner.email);
  await expect(partnerRow).toContainText(partner.business);
  await expect(partnerRow).toContainText("(owner)");
  await expect(partnerRow).toContainText("Draft");
  await expect(partnerRow).toContainText("Traveller");
  await expect(page.getByTestId("users-total")).toHaveText("1 user");
  await snapshot(page, testInfo, "admin-users-partner-found");

  // The traveller: found by phone, a plain traveller with no organisation.
  await search.fill(traveller.phone);
  await page.getByRole("button", { name: "Search" }).click();
  const travellerRow = page.getByRole("row").filter({ hasText: `+91${traveller.phone}` });
  await expect(travellerRow).toHaveCount(1);
  await expect(travellerRow).toContainText("Traveller");
  await expect(travellerRow).not.toContainText("Super admin");

  // Role filter: only administrators.
  await search.fill("");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await chooseOption(page, page.getByLabel("Role", { exact: true }), "super_admin");
  await expect(page).toHaveURL(/role=super_admin/);
  await expect(page.getByRole("row").filter({ hasText: "E2E Super Admin" })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: partner.name })).toHaveCount(0);
  await snapshot(page, testInfo, "admin-users-super-admins");

  // Partners only.
  await chooseOption(page, page.getByLabel("Role", { exact: true }), "");
  await page.getByLabel("Partners only").check();
  await expect(page).toHaveURL(/partnersOnly=true/);
  await expect(page.getByRole("row").filter({ hasText: partner.business })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: `+91${traveller.phone}` })).toHaveCount(0);

  // Provider applications: the new draft is listed and opens a review page.
  await page.getByRole("link", { name: "Provider applications" }).click();
  await expect(page.getByRole("heading", { name: "Provider applications" })).toBeVisible();
  await page.getByRole("link", { name: "Drafts" }).click();
  await expect(page).toHaveURL(/tab=draft/);
  await page.getByRole("link", { name: partner.business }).click();
  await expect(page.getByRole("heading", { name: partner.business, level: 1 })).toBeVisible();
  await expect(page.getByText(partner.email).first()).toBeVisible();
  await expect(page.getByText("Owner identity proof")).toBeVisible();
  // A draft cannot be decided by an admin until the partner submits.
  await expect(page.getByTestId("no-decision-reason")).toContainText("Waiting for the partner");
  await snapshot(page, testInfo, "admin-application-review");

  // Destinations: all four launch destinations with live readiness counts and allowed actions.
  await page.getByRole("link", { name: "Destinations" }).click();
  for (const name of ["Gokarna", "Murudeshwar", "Karwar", "Udupi"]) {
    await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
  }
  // Launch or take offline, depending on the current status (the demo data makes destinations live).
  await expect(page.getByRole("row").filter({ hasText: "Gokarna" }).getByRole("button", { name: /Launch \(make bookable\)|Take offline/ })).toBeVisible();
  await snapshot(page, testInfo, "admin-destinations");

  // Overview figures are live and include the new users and the new provider.
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const totalUsers = page.getByTestId("kpi-total-users");
  await expect(totalUsers).not.toContainText("No data yet");
  expect(Number((await totalUsers.innerText()).match(/\d+/)?.[0])).toBeGreaterThanOrEqual(3);
  expect(Number((await page.getByTestId("kpi-total-providers").innerText()).match(/\d+/)?.[0])).toBeGreaterThanOrEqual(1);
  await snapshot(page, testInfo, "admin-overview");

  // Sign out ends the admin session.
  await identity.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
});
