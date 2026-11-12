import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { devOutboxEnabled } from "../src/modules/messaging/messaging.js";

const base = {
  DATABASE_URL: "postgresql://x:y@localhost:5433/db",
  JWT_ACCESS_SECRET: "a-real-looking-secret-that-is-long-enough-1234",
  OTP_PEPPER: "a-real-looking-pepper-123",
  PUBLIC_WEB_URL: "https://example.com",
};

describe("configuration safety", () => {
  it("exposes the dev OTP outbox only in development/test with the console sender", () => {
    expect(devOutboxEnabled(loadEnv({ ...base, NODE_ENV: "development", MESSAGING_PROVIDER: "console" }))).toBe(true);
    expect(devOutboxEnabled(loadEnv({ ...base, NODE_ENV: "test", MESSAGING_PROVIDER: "console" }))).toBe(true);
    expect(devOutboxEnabled(loadEnv({ ...base, NODE_ENV: "development", MESSAGING_PROVIDER: "msg91" }))).toBe(false);
  });

  it("refuses to boot staging/production with the console sender (so the outbox can never exist there)", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", MESSAGING_PROVIDER: "console" })).toThrow(/console messaging/);
    expect(() => loadEnv({ ...base, NODE_ENV: "staging", MESSAGING_PROVIDER: "console" })).toThrow(/console messaging/);
  });

  it("rejects loose auth rate limits outside development", () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", MESSAGING_PROVIDER: "msg91", PAYMENT_PROVIDER: "razorpay", AUTH_OTP_RATE_LIMIT_PER_MINUTE: "30" }),
    ).toThrow(/rate limits are too loose/);
    expect(loadEnv({ ...base, NODE_ENV: "production", MESSAGING_PROVIDER: "msg91", PAYMENT_PROVIDER: "razorpay" }).AUTH_OTP_RATE_LIMIT_PER_MINUTE).toBe(5);
  });

  it("refuses the mock payment gateway in staging/production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", MESSAGING_PROVIDER: "msg91", PAYMENT_PROVIDER: "mock" })).toThrow(/mock payment gateway/);
    expect(() => loadEnv({ ...base, NODE_ENV: "staging", MESSAGING_PROVIDER: "msg91" })).toThrow(/mock payment gateway/);
  });

  it("refuses demo data in production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", MESSAGING_PROVIDER: "msg91", PAYMENT_PROVIDER: "razorpay", DEMO_DATA_ENABLED: "true" })).toThrow(/demo data/);
  });
});
