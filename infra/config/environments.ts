/**
 * All the choices for each hosted environment live in this one file.
 * Change a number here, run `cdk deploy`, and AWS follows.
 *
 * Two environments are defined:
 *   - demo        the cheapest setup that still scales. This is what can go live today.
 *   - production  bigger and safer. For the real launch (see the note on appMode).
 */

/** The mode the API runs in (its NODE_ENV). */
export type AppMode = "development" | "staging" | "production";

export interface ServiceSizing {
  /** Fargate CPU units for one task: 256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU. */
  cpu: 256 | 512 | 1024;
  /** Memory for one task, in MiB. Must be a size Fargate allows for the CPU above. */
  memoryMiB: 512 | 1024 | 2048 | 3072 | 4096;
  /** Auto scaling never goes below this many tasks. */
  minTasks: number;
  /** Auto scaling never goes above this many tasks. This also caps the bill. */
  maxTasks: number;
  /**
   * How many tasks always run on normal (on-demand) Fargate. Every task above this
   * number runs on Fargate Spot, which costs about 70% less but AWS can stop a Spot
   * task with two minutes' notice. 0 = everything on Spot.
   */
  onDemandBase: number;
  /** Use Fargate Spot for the tasks above onDemandBase. false = on-demand only. */
  spot: boolean;
  /** Add tasks when average CPU stays above this percent; remove them when it falls well below. */
  targetCpuPercent: number;
  /** Add tasks when one task gets more than this many requests per minute. */
  targetRequestsPerTaskPerMinute: number;
}

export interface DatabaseSizing {
  /** RDS instance size in the T4G (burstable, ARM) family. */
  size: "MICRO" | "SMALL" | "MEDIUM" | "LARGE";
  /** A standby copy in a second data centre. Doubles the database cost. */
  multiAz: boolean;
  /** Disk size at the start, in GB. */
  allocatedStorageGb: number;
  /** The disk grows by itself up to this size (storage auto scaling). */
  maxAllocatedStorageGb: number;
  /** How many days of automatic backups to keep. */
  backupRetentionDays: number;
  /**
   * true: the database and buckets cannot be deleted by accident, and a final
   * snapshot is kept if the stack is removed. Use this for real data.
   * false: `cdk destroy` removes everything. Good for a demo.
   */
  protectData: boolean;
}

export interface DomainConfig {
  /** The address people type, for example "nammatrails.in". */
  name: string;
  /** Extra names that should also work, for example ["www.nammatrails.in"]. */
  alternateNames?: string[];
  /** The Route 53 hosted zone that holds the domain. */
  hostedZoneId: string;
  hostedZoneName: string;
}

export interface EnvironmentConfig {
  /** Short name used in stack and resource names. */
  name: string;
  /** AWS region. Mumbai keeps the data in India. */
  region: string;
  /** The two data centres (availability zones) of that region to spread over. */
  availabilityZones: [string, string];

  /**
   * The mode the API runs in. Today the API can only start in "development": the
   * SMS/email sender and the real payment gateway are not built yet, and the API
   * refuses to start in "staging" or "production" without them.
   */
  appMode: AppMode;
  /**
   * Who delivers email and SMS (one-time codes, booking notices).
   *   console  nothing is sent; messages go to the log. Development only.
   *   aws      Amazon SES for email and Amazon SNS for SMS. Billed per message, no monthly fee.
   */
  messagingProvider: "console" | "aws";
  /**
   * With "aws": the sender of every email, for example "Namma Trails <no-reply@nammatrails.in>".
   * Left out, "no-reply@<your domain>" is used. The address (or its domain) is verified in SES.
   */
  mailFrom?: string;
  /** With "aws": SMS details. For Indian numbers the DLT ids are required by the operators. */
  sms?: { senderId?: string; dltEntityId?: string; dltOtpTemplateId?: string };
  paymentProvider: "mock" | "razorpay";
  /** Lets the demo data script run. The API refuses this in production mode. */
  demoData: boolean;

  /** Your own domain. Leave out to use the free CloudFront address (xxxx.cloudfront.net). */
  domain?: DomainConfig;
  /**
   * Only when there is no domain: the CloudFront address, for example
   * "https://d1234abcd.cloudfront.net". It is only known after the first deploy, so
   * deploy once, copy the SiteUrl output here (or pass `-c siteUrl=...`), and deploy again.
   */
  siteUrl?: string;

  /** ARM64 (Graviton) is about 20% cheaper, but the images must be built for ARM. */
  cpuArchitecture: "X86_64" | "ARM64";
  /**
   * 0 = no NAT gateway: tasks run in public subnets with a firewall that only lets the
   * load balancer in. This saves about US$40 a month per gateway.
   * 1 or 2 = tasks run in private subnets behind NAT gateways.
   */
  natGateways: 0 | 1 | 2;

  web: ServiceSizing;
  api: ServiceSizing;
  database: DatabaseSizing;

  /**
   * Amazon DynamoDB for one-time codes and rate-limit counters. Billed per request, so it
   * costs almost nothing at low traffic, and all API tasks share the same counters.
   * false = codes stay in PostgreSQL and each task counts on its own.
   */
  dynamoStores: boolean;
  /** Redis (ElastiCache Serverless). The API does not use Redis yet, so this is off. */
  redis: boolean;
  /** Web firewall (AWS WAF) on the load balancer. About US$9 a month plus traffic. */
  waf: boolean;
  /** Paths the load balancer answers with "404" instead of passing on. At most 5. */
  blockedPaths: string[];

  /**
   * Stop all tasks at night to save money (the site is then down at night).
   * Times are in UTC. India is UTC+5:30, so 17:30 UTC is 23:00 in India.
   */
  nightlyStop?: { stopAtUtc: { hour: number; minute: number }; startAtUtc: { hour: number; minute: number } };

  /**
   * AWS Backup for the database: one backup every night, kept for the given number of days,
   * plus one a week kept longer. Left out, only the database's own short backups exist
   * (database.backupRetentionDays), which is enough for a demo.
   */
  backups?: { dailyRetentionDays: number; weeklyRetentionDays: number };
  /** One CloudWatch dashboard with the main numbers. The first three in an account are free. */
  dashboard: boolean;

  /** Alarms and budget warnings are emailed here. Leave out for no emails. */
  alarmEmail?: string;
  /** Warn by email when the month's AWS bill passes 80% of this (needs alarmEmail). */
  monthlyBudgetUsd?: number;
  /** How long CloudWatch keeps the logs. */
  logRetentionDays: 7 | 14 | 30 | 90;
  /** Detailed container metrics. Costs extra, so it is off for the demo. */
  containerInsights: boolean;
}

const demo: EnvironmentConfig = {
  name: "demo",
  region: "ap-south-1",
  availabilityZones: ["ap-south-1a", "ap-south-1b"],

  appMode: "development",
  messagingProvider: "console",
  paymentProvider: "mock",
  demoData: true,

  cpuArchitecture: "X86_64",
  natGateways: 0,

  // One small task each, everything on Spot. Scales out to 3 when busy.
  web: { cpu: 256, memoryMiB: 512, minTasks: 1, maxTasks: 3, onDemandBase: 0, spot: true, targetCpuPercent: 65, targetRequestsPerTaskPerMinute: 600 },
  api: { cpu: 256, memoryMiB: 512, minTasks: 1, maxTasks: 3, onDemandBase: 0, spot: true, targetCpuPercent: 65, targetRequestsPerTaskPerMinute: 600 },
  database: { size: "MICRO", multiAz: false, allocatedStorageGb: 20, maxAllocatedStorageGb: 50, backupRetentionDays: 1, protectData: false },

  dynamoStores: true,
  redis: false,
  waf: false,
  // In development mode the API has two helper pages that must not be public:
  // the page that shows one-time codes, and the API docs. The test-payment step
  // (/api/v1/dev/payments) stays open: the checkout page calls it, and it needs a sign-in.
  blockedPaths: ["/api/v1/dev/outbox", "/api/v1/dev/outbox/*", "/api/docs", "/api/docs/*", "/api/docs-json"],

  dashboard: true,
  logRetentionDays: 7,
  containerInsights: false,
};

const production: EnvironmentConfig = {
  name: "production",
  region: "ap-south-1",
  availabilityZones: ["ap-south-1a", "ap-south-1b"],

  // The API will only start in this mode once real messaging and payments are built.
  appMode: "production",
  messagingProvider: "aws",
  paymentProvider: "razorpay",
  demoData: false,

  cpuArchitecture: "X86_64",
  natGateways: 0,

  // Two tasks each, in two data centres. The first task of each service is on-demand,
  // so a Spot interruption can never take a whole service down.
  web: { cpu: 512, memoryMiB: 1024, minTasks: 2, maxTasks: 8, onDemandBase: 1, spot: true, targetCpuPercent: 60, targetRequestsPerTaskPerMinute: 1000 },
  api: { cpu: 512, memoryMiB: 1024, minTasks: 2, maxTasks: 8, onDemandBase: 1, spot: true, targetCpuPercent: 60, targetRequestsPerTaskPerMinute: 1000 },
  database: { size: "SMALL", multiAz: true, allocatedStorageGb: 30, maxAllocatedStorageGb: 200, backupRetentionDays: 14, protectData: true },

  dynamoStores: true,
  redis: false,
  waf: true,
  blockedPaths: [],

  // Every night, kept 35 days; every week, kept 90 days.
  backups: { dailyRetentionDays: 35, weeklyRetentionDays: 90 },
  dashboard: true,

  logRetentionDays: 30,
  containerInsights: true,
};

export const environments: Record<string, EnvironmentConfig> = { demo, production };

/** Values that may be passed on the command line with `-c name=value`, so the file need not be edited. */
export interface ConfigOverrides {
  siteUrl?: string;
  mailFrom?: string;
  alarmEmail?: string;
  monthlyBudgetUsd?: string;
  domainName?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
}

export function resolveConfig(name: string, overrides: ConfigOverrides = {}): EnvironmentConfig {
  const base = environments[name];
  if (!base) throw new Error(`Unknown environment "${name}". Known: ${Object.keys(environments).join(", ")}.`);
  const config: EnvironmentConfig = { ...base };

  if (overrides.siteUrl) config.siteUrl = overrides.siteUrl.replace(/\/$/, "");
  if (overrides.alarmEmail) config.alarmEmail = overrides.alarmEmail;
  if (overrides.mailFrom) config.mailFrom = overrides.mailFrom;
  if (overrides.monthlyBudgetUsd) config.monthlyBudgetUsd = Number(overrides.monthlyBudgetUsd);
  if (overrides.domainName) {
    if (!overrides.hostedZoneId) throw new Error("domainName also needs hostedZoneId (the Route 53 hosted zone of the domain).");
    config.domain = {
      name: overrides.domainName,
      hostedZoneId: overrides.hostedZoneId,
      hostedZoneName: overrides.hostedZoneName ?? overrides.domainName,
    };
  }

  validate(config);
  return config;
}

function validate(config: EnvironmentConfig): void {
  const problems: string[] = [];
  for (const [label, service] of [["web", config.web], ["api", config.api]] as const) {
    if (service.minTasks < 0 || service.maxTasks < 1 || service.minTasks > service.maxTasks) problems.push(`${label}: minTasks must be between 0 and maxTasks.`);
    if (service.onDemandBase > service.maxTasks) problems.push(`${label}: onDemandBase cannot be more than maxTasks.`);
    if (!service.spot && service.onDemandBase > 0) problems.push(`${label}: onDemandBase only means something when spot is true.`);
    if (service.targetCpuPercent < 20 || service.targetCpuPercent > 90) problems.push(`${label}: targetCpuPercent should be between 20 and 90.`);
  }
  if (config.blockedPaths.length > 5) problems.push("blockedPaths: a load balancer rule takes at most 5 paths.");
  if (config.database.maxAllocatedStorageGb <= config.database.allocatedStorageGb) problems.push("database: maxAllocatedStorageGb must be more than allocatedStorageGb.");
  if (config.siteUrl && !/^https:\/\/[^/]+$/.test(config.siteUrl)) problems.push(`siteUrl must look like "https://d1234abcd.cloudfront.net" (no path).`);
  if (config.monthlyBudgetUsd !== undefined && !(config.monthlyBudgetUsd > 0)) problems.push("monthlyBudgetUsd must be a number above 0.");
  if (config.appMode === "production" && config.demoData) problems.push("demoData must be false in production mode (the API refuses to start otherwise).");
  if (config.messagingProvider === "aws" && !mailFromOf(config)) {
    problems.push(`messagingProvider "aws" needs mailFrom (or a domain, then no-reply@<domain> is used).`);
  }
  if (config.backups && (config.backups.dailyRetentionDays < 1 || config.backups.weeklyRetentionDays < config.backups.dailyRetentionDays)) {
    problems.push("backups: weeklyRetentionDays must be at least dailyRetentionDays, and both at least 1.");
  }
  if (config.appMode !== "development" && (config.messagingProvider === "console" || config.paymentProvider === "mock")) {
    problems.push(`appMode "${config.appMode}" needs a real messagingProvider and paymentProvider (the API refuses to start otherwise).`);
  }
  if (problems.length > 0) throw new Error(`Environment "${config.name}" is not valid:\n  - ${problems.join("\n  - ")}`);
}

/** The public address of the site, as plain text known before deploying. */
export function knownSiteUrl(config: EnvironmentConfig): string | undefined {
  return config.domain ? `https://${config.domain.name}` : config.siteUrl;
}

/** The sender of every email: the configured one, or no-reply@<domain>. */
export function mailFromOf(config: EnvironmentConfig): string | undefined {
  return config.mailFrom ?? (config.domain ? `no-reply@${config.domain.name}` : undefined);
}

/** "Namma Trails <a@b.c>" -> "a@b.c" */
export function addressOf(mailFrom: string): string {
  return (/<([^>]+)>/.exec(mailFrom)?.[1] ?? mailFrom).trim();
}
