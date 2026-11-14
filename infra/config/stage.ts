/**
 * Settings of the "stage" environment: the cheapest way to try the app on AWS.
 *
 * It is one small server that runs the database, the API and the website together.
 * You start it when you want to test and stop it when you are done:
 *
 *   stopped   you pay only for its fixed address and its disk (about US$5 a month)
 *   running   plus about 2 US cents an hour
 *
 * It is for testing, not for real visitors: one server, no standby, and its database
 * is a container on the same disk.
 */
export interface StageConfig {
  region: string;
  /** The data centre (availability zone) the server lives in. */
  availabilityZone: string;
  /** Server size. t3.small = 2 vCPU, 2 GB memory: enough for the three containers. */
  instanceType: string;
  /** Disk size in GB. Holds the system, the images and the database. */
  diskGb: number;
  /**
   * The public address, for example "https://d1234abcd.cloudfront.net". It is only known
   * after the first deploy: deploy once, copy the SiteUrl output here (or pass
   * `-c siteUrl=...`), deploy again and restart the server.
   */
  siteUrl?: string;
  /** Load the demo partners, listings and bookings on the first start. */
  demoData: boolean;
  /**
   * Stops the server every day at this time (UTC), in case you forget. India is
   * UTC+5:30, so 18:30 UTC is midnight in India. Leave out to never stop it by itself.
   */
  autoStopAtUtc?: { hour: number; minute: number };
  /**
   * Paths that answer "404" instead of reaching the API. In development mode the API
   * has two helper pages that should not be open to everyone: the page that shows
   * one-time codes, and the API docs. Read the codes with `pnpm stage:codes` instead.
   */
  blockedPaths: string[];
  /** Emails you when the month's AWS bill passes 80% of monthlyBudgetUsd. */
  alarmEmail?: string;
  monthlyBudgetUsd?: number;
}

export const stage: StageConfig = {
  // Sydney: the only region this AWS account allows on its current plan.
  // For Mumbai use "ap-south-1" and "ap-south-1a" (the account plan must allow it).
  region: "ap-southeast-2",
  availabilityZone: "ap-southeast-2a",
  instanceType: "t3.small",
  diskGb: 16,
  // The address AWS gave this environment on its first deploy.
  siteUrl: "https://d2ppxhqgzoul0v.cloudfront.net",
  demoData: true,
  autoStopAtUtc: { hour: 18, minute: 30 },
  // Only the page that lists one-time codes, and the API docs. The test-payment step
  // (/api/v1/dev/payments) must stay open: the checkout page calls it, and it needs a sign-in.
  blockedPaths: ["/api/v1/dev/outbox", "/api/docs", "/api/docs-json"],
};

export interface StageOverrides {
  siteUrl?: string;
  alarmEmail?: string;
  monthlyBudgetUsd?: string;
}

export function resolveStageConfig(overrides: StageOverrides = {}): StageConfig {
  const config: StageConfig = { ...stage };
  if (overrides.siteUrl) config.siteUrl = overrides.siteUrl.replace(/\/$/, "");
  if (overrides.alarmEmail) config.alarmEmail = overrides.alarmEmail;
  if (overrides.monthlyBudgetUsd) config.monthlyBudgetUsd = Number(overrides.monthlyBudgetUsd);

  const problems: string[] = [];
  if (config.siteUrl && !/^https:\/\/[^/]+$/.test(config.siteUrl)) problems.push(`siteUrl must look like "https://d1234abcd.cloudfront.net" (no path).`);
  if (config.diskGb < 12) problems.push("diskGb must be at least 12: the images and the database need the room.");
  if (config.monthlyBudgetUsd !== undefined && !(config.monthlyBudgetUsd > 0)) problems.push("monthlyBudgetUsd must be a number above 0.");
  if (config.monthlyBudgetUsd && !config.alarmEmail) problems.push("monthlyBudgetUsd needs alarmEmail (where the warning is sent).");
  if (config.autoStopAtUtc && (config.autoStopAtUtc.hour < 0 || config.autoStopAtUtc.hour > 23 || config.autoStopAtUtc.minute < 0 || config.autoStopAtUtc.minute > 59)) {
    problems.push("autoStopAtUtc must be a time of day (hour 0 to 23, minute 0 to 59).");
  }
  if (problems.length > 0) throw new Error(`The stage environment is not valid:\n  - ${problems.join("\n  - ")}`);
  return config;
}
