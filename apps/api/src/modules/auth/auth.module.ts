import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { dynamoClient } from "../../common/aws/clients.js";
import { ENV, type Env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { MessagingModule } from "../messaging/messaging.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { DynamoOtpStore, OtpStore, PrismaOtpStore } from "./otp-store.js";
import { OtpService } from "./otp.service.js";
import { TokenService } from "./token.service.js";

@Module({
  imports: [JwtModule.register({}), MessagingModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    {
      // OTP_STORE picks where one-time codes are kept (see otp-store.ts).
      provide: OtpStore,
      inject: [ENV, PrismaService],
      useFactory: (env: Env, prisma: PrismaService) =>
        env.OTP_STORE === "dynamodb" && env.DYNAMODB_TABLE_OTP ? new DynamoOtpStore(dynamoClient(env), env.DYNAMODB_TABLE_OTP) : new PrismaOtpStore(prisma),
    },
  ],
  exports: [TokenService],
})
export class AuthModule {}
