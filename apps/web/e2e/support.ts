import type { APIRequestContext, Locator, Page, TestInfo } from "@playwright/test";

export const API_URL = `${process.env.E2E_API_URL ?? "http://localhost:4000"}/api/v1`;

/** A random, valid Indian mobile number (10 digits, starting 7) so every run creates fresh users. */
export function uniquePhone(): string {
  return `7${Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, "0")}`;
}

/**
 * Reads the OTP the API "sent" to a phone, from the development-only outbox
 * (GET /api/v1/dev/outbox). That route exists only with the console message
 * sender in development/test, never in staging or production.
 */
export async function readOtp(request: APIRequestContext, phone: string, sentAfter: number): Promise<string> {
  const to = `+91${phone}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await request.get(`${API_URL}/dev/outbox`, { params: { to } });
    if (!res.ok()) throw new Error(`dev outbox unavailable (${res.status()}). Is the API running with MESSAGING_PROVIDER=console?`);
    const { data } = (await res.json()) as { data: { template: string; variables: { code?: string }; sentAt: string }[] };
    const otp = data.find((m) => m.template === "otp" && Date.parse(m.sentAt) >= sentAfter - 1000 && m.variables.code);
    if (otp?.variables.code) return otp.variables.code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No OTP was sent to ${to}`);
}

/** Chooses an option, by its value, in one of the site's own dropdowns (the Select component). */
export async function chooseOption(page: Page, dropdown: Locator, value: string) {
  await dropdown.click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

/** Chooses a day ("YYYY-MM-DD") in one of the site's own date fields (the DatePicker component). */
export async function pickDate(page: Page, field: Locator, date: string) {
  await field.click();
  await page.locator('[role="dialog"][popover]').waitFor();
  for (let month = 0; month < 24; month++) {
    const day = page.locator(`[data-date="${date}"]`);
    if (await day.count()) {
      await day.click();
      return;
    }
    await page.getByRole("button", { name: "Next month" }).click();
  }
  throw new Error(`The calendar never reached ${date}`);
}

/** Saves a full-page screenshot into the report (and test-results) for review. */
export async function snapshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}
