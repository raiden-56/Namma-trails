import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { DomainError, addDays, istDateOf, istInstant } from "@kt/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { BookingEngine } from "../src/modules/bookings/engine.js";
import { MockGateway } from "../src/modules/bookings/support.js";

/**
 * Concurrency guarantees of the booking engine against a real PostgreSQL.
 * Needs the demo data (pnpm db:seed:demo). Run with: RUN_DB_TESTS=1 pnpm --filter @kt/api test
 * Temporary inventory is closed/deactivated afterwards so it never shows to travellers.
 */
const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;

let prisma: PrismaClient;
let engine: BookingEngine;
let travellerId: string;
const cleanup: (() => Promise<unknown>)[] = [];

/** A free early-morning (03:00–05:59 IST) test-only departure time on that date, so reruns never collide with earlier fixtures. */
async function freeTestTime(inventoryItemId: string, date: string): Promise<string> {
  const taken = new Set(
    (await prisma.availabilitySlot.findMany({ where: { inventoryItemId, date: new Date(`${date}T00:00:00Z`) }, select: { startsAt: true } })).map((s) => s.startsAt.getTime()),
  );
  for (let m = 0; m < 180; m++) {
    const time = `0${3 + Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    if (!taken.has(istInstant(date, time).getTime())) return time;
  }
  throw new Error("No free test time left on " + date);
}

beforeAll(async () => {
  if (!enabled) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  engine = new BookingEngine(prisma, new MockGateway());
  const traveller = await prisma.user.findUnique({ where: { email: "meera@demo.example.com" } });
  if (!traveller) throw new Error("Demo data missing: run pnpm db:seed:demo");
  travellerId = traveller.id;
});

afterAll(async () => {
  if (!enabled) return;
  for (const fn of cleanup.reverse()) await fn().catch(() => undefined);
  await prisma.$disconnect();
});

async function settle<T>(tasks: Promise<T>[]) {
  const results = await Promise.allSettled(tasks);
  const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value as T] : []));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason as Error);
  return { ok, failed };
}

suite("booking engine concurrency (PostgreSQL)", () => {
  it("never oversells a departure: 8 simultaneous requests for the last 3 seats", async () => {
    const service = await prisma.service.findUniqueOrThrow({ where: { slug: "kali-sunset" }, include: { inventoryItems: true } });
    const date = addDays(istDateOf(new Date()), 28);
    const startsAt = istInstant(date, await freeTestTime(service.inventoryItems[0]!.id, date)); // early-morning test-only time: never a demo departure
    const slot = await prisma.availabilitySlot.create({
      data: { inventoryItemId: service.inventoryItems[0]!.id, date: new Date(`${date}T00:00:00Z`), startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity: 3 },
    });
    const created: string[] = [];
    cleanup.push(async () => {
      for (const id of created) await engine.cancel(id, "traveler", travellerId, "test cleanup").catch(() => undefined);
      await prisma.availabilitySlot.update({ where: { id: slot.id }, data: { status: "closed", statusReason: "test fixture" } });
    });

    const { ok, failed } = await settle(Array.from({ length: 8 }, () => engine.create({ serviceSlug: "kali-sunset", slotId: slot.id, adults: 1 }, travellerId)));
    created.push(...ok.map((r) => r.bookingId));

    expect(ok).toHaveLength(3);
    expect(failed).toHaveLength(5);
    for (const e of failed) expect(e instanceof DomainError ? e.code : String(e)).toBe("INVENTORY_UNAVAILABLE");
    const after = await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(after.held + after.committed).toBe(3);
    expect(after.held + after.committed).toBeLessThanOrEqual(after.capacity);
  }, 60_000);

  it("never double-books the last room on overlapping nights", async () => {
    const service = await prisma.service.findUniqueOrThrow({ where: { slug: "seabreeze-rooms" } });
    const plan = await prisma.pricePlan.findFirstOrThrow({ where: { serviceId: service.id } });
    const item = await prisma.inventoryItem.create({ data: { providerId: service.providerId, serviceId: service.id, name: "Test-only room", totalUnits: 1, capacity: 2 } });
    await prisma.pricePlan.create({ data: { serviceId: service.id, inventoryItemId: item.id, name: "Test-only room", model: plan.model, baseAmount: plan.baseAmount, includedOccupancy: 2 } });
    const created: string[] = [];
    cleanup.push(async () => {
      for (const id of created) await engine.cancel(id, "traveler", travellerId, "test cleanup").catch(() => undefined);
      await prisma.inventoryItem.update({ where: { id: item.id }, data: { isActive: false } });
      await prisma.pricePlan.updateMany({ where: { inventoryItemId: item.id }, data: { isActive: false } });
    });
    const checkIn = addDays(istDateOf(new Date()), 26);

    const { ok, failed } = await settle(
      Array.from({ length: 4 }, (_, i) =>
        engine.create({ serviceSlug: "seabreeze-rooms", inventoryItemId: item.id, checkIn: addDays(checkIn, i % 2), checkOut: addDays(checkIn, 2), units: 1, adults: 2 }, travellerId),
      ),
    );
    created.push(...ok.map((r) => r.bookingId));

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(3);
    const nights = await prisma.inventoryReservation.groupBy({ by: ["nightDate"], _sum: { units: true }, where: { inventoryItemId: item.id, releasedAt: null } });
    for (const n of nights) expect(n._sum.units).toBeLessThanOrEqual(1);
  }, 60_000);

  it("releases held seats when a payment fails", async () => {
    const service = await prisma.service.findUniqueOrThrow({ where: { slug: "kali-sunset" }, include: { inventoryItems: true } });
    const date = addDays(istDateOf(new Date()), 27);
    const startsAt = istInstant(date, await freeTestTime(service.inventoryItems[0]!.id, date));
    const slot = await prisma.availabilitySlot.create({
      data: { inventoryItemId: service.inventoryItems[0]!.id, date: new Date(`${date}T00:00:00Z`), startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), capacity: 2 },
    });
    cleanup.push(() => prisma.availabilitySlot.update({ where: { id: slot.id }, data: { status: "closed", statusReason: "test fixture" } }));

    const r = await engine.create({ serviceSlug: "kali-sunset", slotId: slot.id, adults: 2 }, travellerId);
    expect((await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).held).toBe(2);
    await engine.failPayment(r.payment!.id);
    const after = await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(after.held).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: r.bookingId } })).status).toBe("failed");
  }, 60_000);
});
