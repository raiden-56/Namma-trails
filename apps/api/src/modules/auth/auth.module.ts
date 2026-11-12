import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MessagingModule } from "../messaging/messaging.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { OtpService } from "./otp.service.js";
import { TokenService } from "./token.service.js";

@Module({
  imports: [JwtModule.register({}), MessagingModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
