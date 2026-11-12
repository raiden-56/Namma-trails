import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ErrorBody as BaseErrorBody } from "../src/common/errors/api-error.js";

type ErrorBody = BaseErrorBody & { error: { details: { path: string }[] } };

/**
 * Boots the real application without a database (port 1 is never a Postgres)
 * to verify cross-cutting HTTP behaviour: deny-by-default auth, validation,
 * the error envelope, and readiness reporting. Database-backed flows are
 * covered by integration tests that run against Postgres (see docs/14).
 */
let app: INestApplication;
let base: string;

beforeAll(async () => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
    JWT_ACCESS_SECRET: "test-secret-test-secret-test-secret-123",
    OTP_PEPPER: "test-pepper-test-pepper",
    MESSAGING_PROVIDER: "console",
  });
  const { NestFactory } = await import("@nestjs/core");
  const { VersioningType } = await import("@nestjs/common");
  const { AppModule } = await import("../src/app.module.js");
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api", { exclude: ["health", "health/ready"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app?.close();
});

const get = (path: string, headers: Record<string, string> = {}) => fetch(base + path, { headers });
const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("HTTP security baseline", () => {
  it("reports liveness without dependencies", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
  });

  it("reports not-ready (503) when the database is unreachable", async () => {
    const res = await get("/health/ready");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "not_ready", checks: { database: "down" } });
  });

  it.each(["/api/v1/auth/me", "/api/v1/admin/provider-applications", "/api/v1/provider-onboarding/applications/0190d5f4-0000-7000-8000-000000000000"])(
    "denies %s without a token",
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorBody;
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(typeof body.error.requestId).toBe("string");
    },
  );

  it("rejects forged or expired bearer tokens", async () => {
    const res = await get("/api/v1/auth/me", { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid" });
    expect(res.status).toBe(401);
  });

  it("validates input with field-level details before touching the database", async () => {
    const res = await post("/api/v1/auth/otp/request", { channel: "sms", destination: "1", purpose: "nope" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["destination", "purpose"]));
  });

  it("returns 503 rather than leaking internals when the database is down", async () => {
    const res = await get("/api/v1/destinations");
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toMatch(/prisma|postgres|stack/i);
  });

  it("refuses refresh without a session cookie", async () => {
    const res = await post("/api/v1/auth/refresh", {});
    expect(res.status).toBe(401);
  });
});
