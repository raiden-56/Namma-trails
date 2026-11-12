import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Principal } from "@kt/domain";
import { z } from "zod";
import { CurrentPrincipal, RequirePermissions } from "../../common/auth/principal.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { BookingsService } from "./bookings.service.js";
import { bookingRequestSchema } from "./marketplace.controller.js";

const createSchema = bookingRequestSchema.extend({
  guests: z.array(z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().max(16).optional(), age: z.number().int().min(0).max(120).optional() })).max(20).optional(),
  specialRequests: z.string().trim().max(1000).optional(),
});
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const optionalReason = z.object({ reason: z.string().trim().max(500).optional() });
const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), body: z.string().trim().max(2000).optional() });
const bookingRef = z.string().regex(/^BK-[A-Z0-9]{8}$/);

@ApiTags("traveller")
@ApiBearerAuth()
@Controller({ version: "1" })
export class TravelerBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post("bookings")
  @RequirePermissions("self.booking.create")
  @ApiOperation({ summary: "Book a service: holds inventory; instant bookings return a payment to complete" })
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return { data: await this.bookings.create(principal, body, idempotencyKey?.slice(0, 80)) };
  }

  @Get("me/trips")
  @RequirePermissions("self.booking.read")
  async trips(@CurrentPrincipal() principal: Principal) {
    return { data: await this.bookings.myTrips(principal.userId) };
  }

  @Get("me/bookings/:reference")
  @RequirePermissions("self.booking.read")
  async booking(@CurrentPrincipal() principal: Principal, @Param("reference", new ZodPipe(bookingRef)) ref: string) {
    return { data: await this.bookings.myBooking(principal.userId, ref) };
  }

  @Post("me/bookings/:reference/cancel")
  @RequirePermissions("self.booking.cancel")
  async cancel(@CurrentPrincipal() principal: Principal, @Param("reference", new ZodPipe(bookingRef)) ref: string, @Body(new ZodPipe(reasonSchema)) body: z.infer<typeof reasonSchema>) {
    return { data: await this.bookings.cancelMine(principal.userId, ref, body.reason) };
  }

  @Post("me/bookings/:reference/review")
  @RequirePermissions("self.review.create")
  async review(@CurrentPrincipal() principal: Principal, @Param("reference", new ZodPipe(bookingRef)) ref: string, @Body(new ZodPipe(reviewSchema)) body: z.infer<typeof reviewSchema>) {
    return { data: await this.bookings.review(principal.userId, ref, body) };
  }
}

/** DEVELOPMENT ONLY — registered only when PAYMENT_PROVIDER=mock in development/test (see AppModule). */
@ApiTags("dev")
@ApiBearerAuth()
@Controller({ path: "dev/payments", version: "1" })
export class MockPaymentsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post(":paymentId/complete")
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async complete(@CurrentPrincipal() principal: Principal, @Param("paymentId", ParseUUIDPipe) paymentId: string, @Body(new ZodPipe(z.object({ outcome: z.enum(["success", "failure"]) }))) body: { outcome: "success" | "failure" }) {
    return { data: await this.bookings.mockComplete(principal.userId, paymentId, body.outcome) };
  }
}

@ApiTags("partner")
@ApiBearerAuth()
@Controller({ path: "partner/:providerId", version: "1" })
export class PartnerController {
  constructor(private readonly bookings: BookingsService) {}

  @Get("dashboard")
  async dashboard(@CurrentPrincipal() principal: Principal, @Param("providerId", ParseUUIDPipe) providerId: string) {
    return { data: await this.bookings.partnerDashboard(principal, providerId) };
  }

  @Get("listings")
  async listings(@CurrentPrincipal() principal: Principal, @Param("providerId", ParseUUIDPipe) providerId: string) {
    return { data: await this.bookings.partnerListings(principal, providerId) };
  }

  @Get("bookings")
  async list(
    @CurrentPrincipal() principal: Principal,
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Query("view", new ZodPipe(z.enum(["requests", "upcoming", "past", "all"]).default("upcoming"))) view: "requests" | "upcoming" | "past" | "all",
  ) {
    return { data: await this.bookings.partnerBookings(principal, providerId, view) };
  }

  @Post("bookings/:reference/:action")
  @HttpCode(200)
  async act(
    @CurrentPrincipal() principal: Principal,
    @Param("providerId", ParseUUIDPipe) providerId: string,
    @Param("reference", new ZodPipe(bookingRef)) ref: string,
    @Param("action", new ZodPipe(z.enum(["accept", "reject", "start", "complete", "cancel"]))) action: "accept" | "reject" | "start" | "complete" | "cancel",
    @Body(new ZodPipe(optionalReason)) body: z.infer<typeof optionalReason>,
  ) {
    return { data: await this.bookings.partnerAct(principal, providerId, ref, action, body.reason) };
  }

  @Get("finance")
  async finance(@CurrentPrincipal() principal: Principal, @Param("providerId", ParseUUIDPipe) providerId: string) {
    return { data: await this.bookings.partnerFinance(principal, providerId) };
  }
}
