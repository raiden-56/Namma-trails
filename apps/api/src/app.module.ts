import { randomUUID } from "node:crypto";
import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuditService } from "./common/audit/audit.service.js";
import { AuthGuard } from "./common/auth/auth.guard.js";
import { PrincipalService } from "./common/auth/principal.service.js";
import { AllExceptionsFilter } from "./common/errors/all-exceptions.filter.js";
import { ENV, type Env, loadEnv } from "./config/env.js";
import { AdminOpsController, AdminOpsService } from "./modules/admin/admin-ops.controller.js";
import { MockPaymentsController, PartnerController, TravelerBookingsController } from "./modules/bookings/bookings.controller.js";
import { BookingsService } from "./modules/bookings/bookings.service.js";
import { MarketplaceController, MarketplaceService } from "./modules/bookings/marketplace.controller.js";
import { AdminCatalogController, AdminCatalogService } from "./modules/admin/admin-catalog.controller.js";
import { AdminUsersController, AdminUsersService } from "./modules/admin/admin-users.controller.js";
import { ProviderVerificationController, ProviderVerificationService } from "./modules/admin/provider-verification.controller.js";
import { DevOutboxController } from "./modules/messaging/dev-outbox.controller.js";
import { MessagingModule, devOutboxEnabled } from "./modules/messaging/messaging.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CatalogController } from "./modules/catalog/catalog.controller.js";
import { CatalogService } from "./modules/catalog/catalog.service.js";
import { HealthController } from "./modules/health/health.controller.js";
import { ProviderOnboardingController } from "./modules/provider-onboarding/provider-onboarding.controller.js";
import { ProviderOnboardingService } from "./modules/provider-onboarding/provider-onboarding.service.js";
import { PrismaService } from "./prisma/prisma.service.js";

const env = loadEnv();

/** Cross-cutting infrastructure available to every module. */
@Global()
@Module({
  providers: [{ provide: ENV, useValue: env }, PrismaService, PrincipalService, AuditService],
  exports: [ENV, PrismaService, PrincipalService, AuditService],
})
class CoreModule {}

@Module({
  imports: [
    CoreModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
        genReqId: (req) => (typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : randomUUID()),
        // Never log credentials, tokens or OTPs.
        redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]', "req.body.password", "req.body.code", "req.body.otpCode"],
      },
    }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    AuthModule,
    MessagingModule,
  ],
  controllers: [
    HealthController,
    CatalogController,
    ProviderOnboardingController,
    ProviderVerificationController,
    AdminUsersController,
    AdminCatalogController,
    AdminOpsController,
    MarketplaceController,
    TravelerBookingsController,
    PartnerController,
    // Development-only simulated payment gateway.
    ...(env.PAYMENT_PROVIDER === "mock" && (env.NODE_ENV === "development" || env.NODE_ENV === "test") ? [MockPaymentsController] : []),
    // Never registered in staging/production (env validation forbids the console sender there).
    ...(devOutboxEnabled(env) ? [DevOutboxController] : []),
  ],
  providers: [
    CatalogService,
    ProviderOnboardingService,
    ProviderVerificationService,
    AdminUsersService,
    AdminCatalogService,
    AdminOpsService,
    BookingsService,
    MarketplaceService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

export type { Env };
