import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().int().default(4000),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    /** How many proxies sit in front of the API, so req.ip is the real visitor. 1 = one load balancer; 2 = CDN + load balancer. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    PUBLIC_WEB_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    OTP_PEPPER: z.string().min(16),
    /** console = write messages to the log (development only). aws = Amazon SES for email and Amazon SNS for SMS. */
    MESSAGING_PROVIDER: z.enum(["console", "aws", "msg91", "twilio", "ses"]).default("console"),
    /** Name shown in messages. */
    BRAND_NAME: z.string().min(1).default("Namma Trails"),

    // ── AWS (all optional locally; set by the CDK stacks on AWS) ──
    AWS_REGION: z.string().default("ap-south-1"),
    /** Sender of every email, for example "Namma Trails <no-reply@example.com>". Must be verified in Amazon SES. */
    MAIL_FROM: z.string().optional(),
    /** SMS sender name, where the country allows one. */
    SMS_SENDER_ID: z.string().max(11).optional(),
    /** India only: the DLT entity id and the DLT template id of the one-time-code SMS. */
    SMS_DLT_ENTITY_ID: z.string().optional(),
    SMS_DLT_TEMPLATE_ID_OTP: z.string().optional(),

    /** Where one-time codes are kept. dynamodb = an Amazon DynamoDB table that removes old codes by itself. */
    OTP_STORE: z.enum(["postgres", "dynamodb"]).default("postgres"),
    /** Where rate-limit counters are kept. memory = inside one API process; dynamodb = shared by all API tasks. */
    RATE_LIMIT_STORE: z.enum(["memory", "dynamodb"]).default("memory"),
    DYNAMODB_TABLE_OTP: z.string().optional(),
    DYNAMODB_TABLE_RATE_LIMITS: z.string().optional(),
    /** Only for a local DynamoDB (docker compose): http://localhost:8000 */
    DYNAMODB_ENDPOINT: z.url().optional(),

    // ── File storage (Amazon S3; Adobe S3Mock locally) ──
    /** Only for a local S3 (docker compose): http://localhost:9090. Leave out on AWS. */
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default("ap-south-1"),
    /** Only with S3_ENDPOINT. On AWS the task role gives access, so no keys are stored. */
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_PUBLIC_BUCKET: z.string().optional(),
    S3_PRIVATE_BUCKET: z.string().optional(),
    /**
     * Put in front of every uploaded public file's key (keys start with "media/"). On AWS this is the
     * site address, so files are served by the CDN at https://<site>/media/... Locally it is the S3
     * stand-in, for example http://localhost:9090/kt-public
     */
    MEDIA_BASE_URL: z.string().default(""),
    /** mock = simulated gateway for local development (refused in staging/production). */
    PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
    AUTH_OTP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(100).default(5),
    AUTH_SIGNIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(200).default(10),
    DEMO_DATA_ENABLED: bool,
  })
  .superRefine((env, ctx) => {
    const prodLike = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
    if (prodLike && env.MESSAGING_PROVIDER === "console") {
      ctx.addIssue({ code: "custom", path: ["MESSAGING_PROVIDER"], message: "console messaging is not allowed in staging/production" });
    }
    if (env.NODE_ENV === "production" && env.DEMO_DATA_ENABLED) {
      ctx.addIssue({ code: "custom", path: ["DEMO_DATA_ENABLED"], message: "demo data must be disabled in production" });
    }
    if (prodLike && env.PAYMENT_PROVIDER === "mock") {
      ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: "the mock payment gateway is not allowed in staging/production" });
    }
    if (prodLike && (env.AUTH_OTP_RATE_LIMIT_PER_MINUTE > 10 || env.AUTH_SIGNIN_RATE_LIMIT_PER_MINUTE > 20)) {
      ctx.addIssue({ code: "custom", path: ["AUTH_OTP_RATE_LIMIT_PER_MINUTE"], message: "auth rate limits are too loose for staging/production" });
    }
    if (prodLike && /change-me/.test(env.JWT_ACCESS_SECRET + env.OTP_PEPPER)) {
      ctx.addIssue({ code: "custom", path: ["JWT_ACCESS_SECRET"], message: "replace the example secrets" });
    }
    if (env.MESSAGING_PROVIDER === "aws" && !env.MAIL_FROM) {
      ctx.addIssue({ code: "custom", path: ["MAIL_FROM"], message: "MAIL_FROM is required with MESSAGING_PROVIDER=aws" });
    }
    if (env.OTP_STORE === "dynamodb" && !env.DYNAMODB_TABLE_OTP) {
      ctx.addIssue({ code: "custom", path: ["DYNAMODB_TABLE_OTP"], message: "DYNAMODB_TABLE_OTP is required with OTP_STORE=dynamodb" });
    }
    if (env.RATE_LIMIT_STORE === "dynamodb" && !env.DYNAMODB_TABLE_RATE_LIMITS) {
      ctx.addIssue({ code: "custom", path: ["DYNAMODB_TABLE_RATE_LIMITS"], message: "DYNAMODB_TABLE_RATE_LIMITS is required with RATE_LIMIT_STORE=dynamodb" });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Validates process.env once at boot. The app refuses to start with an invalid configuration. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const ENV = Symbol("ENV");
