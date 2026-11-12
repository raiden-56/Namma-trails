import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { OtpChannel, OtpPurpose } from "../../generated/prisma/client.js";
import { MessageSender } from "../messaging/messaging.js";

const MAX_SENDS_PER_HOUR = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: MessageSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hash(destination: string, purpose: OtpPurpose, code: string): string {
    return createHmac("sha256", this.env.OTP_PEPPER).update(`${destination}|${purpose}|${code}`).digest("hex");
  }

  async send(channel: OtpChannel, destination: string, purpose: OtpPurpose, ip?: string): Promise<{ expiresInSeconds: number }> {
    const since = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.otpVerification.count({ where: { destination, purpose, createdAt: { gte: since } } });
    if (recent >= MAX_SENDS_PER_HOUR) {
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "OTP_RATE_LIMITED", "Too many codes requested. Please try again later.");
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.otpVerification.create({
      data: {
        channel,
        destination,
        purpose,
        codeHash: this.hash(destination, purpose, code),
        expiresAt: new Date(Date.now() + this.env.OTP_TTL_SECONDS * 1000),
        ipAddress: ip ?? null,
      },
    });
    await this.sender.send({ channel, to: destination, template: "otp", variables: { code, minutes: String(Math.round(this.env.OTP_TTL_SECONDS / 60)) } });
    return { expiresInSeconds: this.env.OTP_TTL_SECONDS };
  }

  /** Consumes the latest valid code. Wrong codes count towards the attempt limit. */
  async verify(destination: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.prisma.otpVerification.findFirst({
      where: { destination, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    const invalid = new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "OTP_INVALID", "That code is incorrect or has expired");
    if (!otp || otp.attempts >= otp.maxAttempts) throw invalid;

    const expected = Buffer.from(otp.codeHash, "hex");
    const actual = Buffer.from(this.hash(destination, purpose, code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.otpVerification.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    const { count } = await this.prisma.otpVerification.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (count !== 1) throw invalid; // concurrent double-use
  }
}
