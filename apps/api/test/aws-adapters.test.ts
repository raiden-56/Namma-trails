import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CreateTableCommand, DynamoDBClient, UpdateTimeToLiveCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { publicMediaUrl } from "../src/common/media-url.js";
import { DynamoThrottlerStorage } from "../src/common/throttle/dynamo-throttler-storage.js";
import { loadEnv, type Env } from "../src/config/env.js";
import { DynamoOtpStore } from "../src/modules/auth/otp-store.js";
import { AwsMessageSender } from "../src/modules/messaging/aws-message-sender.js";
import type { TemplateService } from "../src/modules/messaging/template.service.js";
import { DEFAULT_TEMPLATES, fillPlaceholders, renderDefault } from "../src/modules/messaging/templates.js";

/*
 * The AWS adapters, checked without an AWS account.
 *
 * - Message sending is checked against a recording stand-in for the SES and SNS clients.
 * - The DynamoDB stores run against DynamoDB Local when DYNAMODB_ENDPOINT is set
 *   (docker compose up -d dynamodb, then DYNAMODB_ENDPOINT=http://localhost:8000).
 *   Without it those tests are skipped.
 */

const baseEnv = {
  DATABASE_URL: "postgresql://x:x@localhost:5432/x",
  JWT_ACCESS_SECRET: "a".repeat(48),
  OTP_PEPPER: "b".repeat(24),
};

describe("settings for the AWS integrations", () => {
  it("accepts the AWS message provider only with a sender address", () => {
    expect(() => loadEnv({ ...baseEnv, MESSAGING_PROVIDER: "aws" })).toThrow(/MAIL_FROM/);
    expect(loadEnv({ ...baseEnv, MESSAGING_PROVIDER: "aws", MAIL_FROM: "Namma Trails <no-reply@example.com>" }).MESSAGING_PROVIDER).toBe("aws");
  });

  it("needs a table name for each DynamoDB store that is switched on", () => {
    expect(() => loadEnv({ ...baseEnv, OTP_STORE: "dynamodb" })).toThrow(/DYNAMODB_TABLE_OTP/);
    expect(() => loadEnv({ ...baseEnv, RATE_LIMIT_STORE: "dynamodb" })).toThrow(/DYNAMODB_TABLE_RATE_LIMITS/);
    const env = loadEnv({ ...baseEnv, OTP_STORE: "dynamodb", DYNAMODB_TABLE_OTP: "otp", RATE_LIMIT_STORE: "dynamodb", DYNAMODB_TABLE_RATE_LIMITS: "limits" });
    expect(env.OTP_STORE).toBe("dynamodb");
  });

  it("keeps everything local by default", () => {
    const env = loadEnv(baseEnv);
    expect([env.MESSAGING_PROVIDER, env.OTP_STORE, env.RATE_LIMIT_STORE, env.MEDIA_BASE_URL]).toEqual(["console", "postgres", "memory", ""]);
  });

  it("a real message provider lets staging start (console is refused there)", () => {
    const prodLike = { ...baseEnv, NODE_ENV: "staging", PAYMENT_PROVIDER: "razorpay" };
    expect(() => loadEnv({ ...prodLike })).toThrow(/console messaging/);
    expect(loadEnv({ ...prodLike, MESSAGING_PROVIDER: "aws", MAIL_FROM: "no-reply@example.com" }).NODE_ENV).toBe("staging");
  });
});

describe("message wording", () => {
  it("fills placeholders and leaves unknown ones empty", () => {
    expect(fillPlaceholders("Hi {{name}}, code {{ code }}{{missing}}.", { name: "Asha", code: "123456" })).toBe("Hi Asha, code 123456.");
  });

  it("has SMS and email wording for one-time codes", () => {
    const sms = renderDefault("otp", "sms", { code: "123456", minutes: "5", brand: "Namma Trails" });
    expect(sms?.text).toContain("123456");
    expect(sms?.text).toContain("5 minutes");
    expect(sms?.text.length).toBeLessThanOrEqual(160); // one SMS segment = one charge
    const email = renderDefault("otp", "email", { code: "123456", minutes: "5", brand: "Namma Trails" });
    expect(email?.subject).toContain("123456");
  });

  it("every built-in SMS fits one SMS segment with realistic values", () => {
    const values = { brand: "Namma Trails", code: "123456", minutes: "5", reference: "BK-ABCD1234", service: "Morning kayaking on the Kali river", date: "Sat, 14 Nov 2026, 07:30" };
    for (const [event, template] of Object.entries(DEFAULT_TEMPLATES)) {
      if (!template.sms) continue;
      expect(fillPlaceholders(template.sms, values).length, event).toBeLessThanOrEqual(160);
    }
  });

  it("returns null when an event has no wording for a channel", () => {
    expect(renderDefault("booking_requested", "sms", {})).toBeNull();
    expect(renderDefault("no_such_event", "email", {})).toBeNull();
  });
});

describe("AwsMessageSender", () => {
  const env = loadEnv({ ...baseEnv, MESSAGING_PROVIDER: "aws", MAIL_FROM: "Namma Trails <no-reply@example.com>", SMS_DLT_ENTITY_ID: "1101234567890", SMS_DLT_TEMPLATE_ID_OTP: "1107000000001", SMS_SENDER_ID: "NAMTRL" });
  const templates = {
    render: async (event: string, channel: "sms" | "email", variables: Record<string, string>) => renderDefault(event, channel, { brand: "Namma Trails", ...variables })!,
  } as unknown as TemplateService;
  const recorder = () => {
    const sent: Array<{ name: string; input: any }> = [];
    return { sent, client: { send: async (command: { constructor: { name: string }; input: unknown }) => void sent.push({ name: command.constructor.name, input: command.input }) } as any };
  };

  it("sends email through SES from the configured address", async () => {
    const ses = recorder();
    const sns = recorder();
    await new AwsMessageSender(env, templates, ses.client, sns.client).send({ channel: "email", to: "asha@example.com", template: "otp", variables: { code: "654321", minutes: "5" } });
    expect(sns.sent).toHaveLength(0);
    expect(ses.sent).toHaveLength(1);
    const { name, input } = ses.sent[0]!;
    expect(name).toBe("SendEmailCommand");
    expect(input.FromEmailAddress).toBe("Namma Trails <no-reply@example.com>");
    expect(input.Destination.ToAddresses).toEqual(["asha@example.com"]);
    expect(input.Content.Simple.Subject.Data).toContain("654321");
    expect(input.Content.Simple.Body.Text.Data).toContain("654321");
  });

  it("sends SMS through SNS as transactional, with the India DLT ids", async () => {
    const ses = recorder();
    const sns = recorder();
    await new AwsMessageSender(env, templates, ses.client, sns.client).send({ channel: "sms", to: "+919876543210", template: "otp", variables: { code: "654321", minutes: "5" } });
    expect(ses.sent).toHaveLength(0);
    const { name, input } = sns.sent[0]!;
    expect(name).toBe("PublishCommand");
    expect(input.PhoneNumber).toBe("+919876543210");
    expect(input.Message).toContain("654321");
    expect(input.MessageAttributes["AWS.SNS.SMS.SMSType"].StringValue).toBe("Transactional");
    expect(input.MessageAttributes["AWS.SNS.SMS.SenderID"].StringValue).toBe("NAMTRL");
    expect(input.MessageAttributes["AWS.MM.SMS.EntityId"].StringValue).toBe("1101234567890");
    expect(input.MessageAttributes["AWS.MM.SMS.TemplateId"].StringValue).toBe("1107000000001");
  });

  it("passes a provider error on, so the caller can record the message as failed", async () => {
    const failing = { send: async () => Promise.reject(new Error("MessageRejected: Email address is not verified")) } as any;
    await expect(new AwsMessageSender(env, templates, failing, failing).send({ channel: "email", to: "x@example.com", template: "otp", variables: { code: "1", minutes: "5" } })).rejects.toThrow(/not verified/);
  });
});

describe("public file addresses", () => {
  it("leaves the website's own files alone and puts uploads behind the CDN path", () => {
    const before = process.env.MEDIA_BASE_URL;
    delete process.env.MEDIA_BASE_URL;
    expect(publicMediaUrl({ bucket: "static", objectKey: "/images/photos/om-beach.jpg" })).toBe("/images/photos/om-beach.jpg");
    expect(publicMediaUrl({ bucket: "kt-public", objectKey: "media/providers/p1/services/a.jpg" })).toBe("/media/providers/p1/services/a.jpg");
    process.env.MEDIA_BASE_URL = "https://example.com/";
    expect(publicMediaUrl({ bucket: "kt-public", objectKey: "media/destinations/a.webp" })).toBe("https://example.com/media/destinations/a.webp");
    if (before === undefined) delete process.env.MEDIA_BASE_URL;
    else process.env.MEDIA_BASE_URL = before;
  });
});

describe("no permanent deletes in the app code", () => {
  // Rows are never removed for good: a "deleted" row is marked (deleted_at / removed_at / is_active)
  // and kept. This test fails if a hard delete is added. Seed and reset scripts are not app code.
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "generated" ? [] : files(full);
      return full.endsWith(".ts") ? [full] : [];
    });
  const source = files(path.join(__dirname, "..", "src")).filter((file) => !/[\\/]prisma[\\/](seed|seed-demo|create-admin)\.ts$/.test(file));

  it("uses no delete(), deleteMany() or raw DELETE / TRUNCATE", () => {
    const offenders: string[] = [];
    for (const file of source) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments
        if (/\.\s*(delete|deleteMany)\s*\(/.test(line) && !/\b(Map|Set|cache|headers|searchParams|params)\b.*\.delete\(/.test(line) && !/\b(this\.)?(cache|map|set)\.delete\(/i.test(line)) {
          offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}  ${line.trim()}`);
        }
        if (/\b(DELETE\s+FROM|TRUNCATE)\b/i.test(line)) offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}  ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

/* ── DynamoDB stores, against DynamoDB Local ─────────────────────────────── */

const endpoint = process.env.DYNAMODB_ENDPOINT;
const dynamo = describe.skipIf(!endpoint);

dynamo("DynamoDB stores (DynamoDB Local)", () => {
  const raw = new DynamoDBClient({ region: "ap-south-1", endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } });
  const db = DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } });
  const suffix = Date.now().toString(36);
  const otpTable = `test-otp-${suffix}`;
  const limitsTable = `test-limits-${suffix}`;

  const createTables = async () => {
    await raw.send(
      new CreateTableCommand({
        TableName: otpTable,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
      }),
    );
    await raw.send(new CreateTableCommand({ TableName: limitsTable, BillingMode: "PAY_PER_REQUEST", AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }], KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }] }));
    for (const TableName of [otpTable, limitsTable]) {
      await raw.send(new UpdateTimeToLiveCommand({ TableName, TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true } })).catch(() => undefined);
    }
  };

  it("one-time codes: count, newest wins, wrong tries are counted, a code works once", async () => {
    await createTables();
    const store = new DynamoOtpStore(db, otpTable);
    const phone = "+919876500001";
    const inFiveMinutes = () => new Date(Date.now() + 300_000);

    expect(await store.latestActive(phone, "sign_in", new Date())).toBeNull();
    await store.create({ channel: "sms", destination: phone, purpose: "sign_in", codeHash: "aa", expiresAt: inFiveMinutes(), ip: "203.0.113.7" });
    await new Promise((r) => setTimeout(r, 15));
    await store.create({ channel: "sms", destination: phone, purpose: "sign_in", codeHash: "bb", expiresAt: inFiveMinutes() });
    // Another purpose and another phone do not mix in.
    await store.create({ channel: "sms", destination: phone, purpose: "sign_up", codeHash: "cc", expiresAt: inFiveMinutes() });
    await store.create({ channel: "sms", destination: "+919876500002", purpose: "sign_in", codeHash: "dd", expiresAt: inFiveMinutes() });

    expect(await store.countSince(phone, "sign_in", new Date(Date.now() - 3_600_000))).toBe(2);
    expect(await store.countSince(phone, "sign_in", new Date(Date.now() + 60_000))).toBe(0);

    const latest = await store.latestActive(phone, "sign_in", new Date());
    expect(latest?.codeHash).toBe("bb");
    expect(latest?.attempts).toBe(0);

    await store.recordFailedAttempt(latest!);
    await store.recordFailedAttempt(latest!);
    expect((await store.latestActive(phone, "sign_in", new Date()))?.attempts).toBe(2);

    // Two people racing to use the same code: exactly one wins.
    const results = await Promise.all([store.consume(latest!, new Date()), store.consume(latest!, new Date())]);
    expect(results.sort()).toEqual([false, true]);
    // The used code is gone; the older unused one is next.
    expect((await store.latestActive(phone, "sign_in", new Date()))?.codeHash).toBe("aa");
  });

  it("one-time codes: an expired code is never returned", async () => {
    const store = new DynamoOtpStore(db, otpTable);
    const email = "expired@example.com";
    await store.create({ channel: "email", destination: email, purpose: "reset_password", codeHash: "ee", expiresAt: new Date(Date.now() - 1000) });
    expect(await store.latestActive(email, "reset_password", new Date())).toBeNull();
    // It still counts towards "codes requested in the last hour".
    expect(await store.countSince(email, "reset_password", new Date(Date.now() - 3_600_000))).toBe(1);
  });

  it("rate limits: counts are shared, block after the limit, and each visitor has their own", async () => {
    // Two storage objects stand for two API tasks sharing one table.
    const taskA = new DynamoThrottlerStorage(db, limitsTable);
    const taskB = new DynamoThrottlerStorage(db, limitsTable);
    const limit = 3;
    const ttl = 60_000;
    const hits = [];
    for (let i = 0; i < 5; i++) hits.push(await (i % 2 ? taskA : taskB).increment("visitor-1", ttl, limit, 0, "default"));
    expect(hits.map((h) => h.totalHits)).toEqual([1, 2, 3, 4, 5]);
    expect(hits.map((h) => h.isBlocked)).toEqual([false, false, false, true, true]);
    expect(hits[4]!.timeToExpire).toBeGreaterThan(0);
    expect(hits[4]!.timeToExpire).toBeLessThanOrEqual(60);

    const other = await taskA.increment("visitor-2", ttl, limit, 0, "default");
    expect(other.totalHits).toBe(1);
    expect(other.isBlocked).toBe(false);
  });

  it("rate limits: many requests at once are all counted", async () => {
    const storage = new DynamoThrottlerStorage(db, limitsTable);
    const all = await Promise.all(Array.from({ length: 25 }, () => storage.increment("burst", 60_000, 1000, 0, "default")));
    expect(all.map((r) => r.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("rate limits: if the table cannot be reached the request is allowed", async () => {
    const broken = new DynamoThrottlerStorage(db, "table-that-does-not-exist");
    const result = await broken.increment("anyone", 60_000, 1, 0, "default");
    expect(result.isBlocked).toBe(false);
  });
});
