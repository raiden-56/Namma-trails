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
    PUBLIC_WEB_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    OTP_PEPPER: z.string().min(16),
    MESSAGING_PROVIDER: z.enum(["console", "msg91", "twilio", "ses"]).default("console"),
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
