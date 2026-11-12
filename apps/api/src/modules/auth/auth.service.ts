import { HttpStatus, Injectable } from "@nestjs/common";
import { hashPassword, verifyPassword } from "./password.js";
import { indianMobile, type Principal } from "@kt/domain";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { OtpChannel, OtpPurpose } from "../../generated/prisma/client.js";
import { OtpService } from "./otp.service.js";
import { type IssuedTokens, TokenService } from "./token.service.js";

type Meta = { userAgent?: string; ip?: string };

// A real hash verified when the account does not exist, so sign-in timing does not reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("timing-equaliser-not-a-password"));

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  normalizeDestination(channel: OtpChannel, destination: string): string {
    if (channel === "email") return destination.trim().toLowerCase();
    const parsed = indianMobile.safeParse(destination);
    if (!parsed.success) throw ApiError.badRequest("INVALID_PHONE", "Enter a valid 10-digit Indian mobile number");
    return parsed.data;
  }

  requestOtp(channel: OtpChannel, destination: string, purpose: OtpPurpose, ip?: string) {
    // The response never reveals whether an account exists.
    return this.otp.send(channel, this.normalizeDestination(channel, destination), purpose, ip);
  }

  /** Passwordless phone sign-in. Creates a traveler account on first use (profile completed afterwards). */
  async signInWithPhoneOtp(phoneInput: string, code: string, fullName: string | undefined, meta: Meta): Promise<IssuedTokens & { isNewUser: boolean }> {
    const phone = this.normalizeDestination("sms", phoneInput);
    await this.otp.verify(phone, "sign_in", code);
    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;
    if (!user) {
      user = await this.createTraveler({ phone, fullName: fullName?.trim() || "Traveller" });
      isNewUser = true;
    } else if (!user.phoneVerified) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerified: new Date() } });
    }
    this.assertActive(user.status);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { ...(await this.tokens.issue(user.id, meta)), isNewUser };
  }

  /** Account with password; the phone number must be proven with a sign_up OTP in the same request. */
  async signUp(
    input: { fullName: string; phone: string; email?: string; password?: string; otpCode: string; termsVersion?: string },
    meta: Meta,
  ): Promise<IssuedTokens> {
    const phone = this.normalizeDestination("sms", input.phone);
    const email = input.email?.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] }, select: { id: true } });
    if (existing) throw ApiError.conflict("ACCOUNT_EXISTS", "An account already exists for this phone or email. Please sign in.");
    await this.otp.verify(phone, "sign_up", input.otpCode);
    const passwordHash = input.password ? await hashPassword(input.password) : null;
    const user = await this.createTraveler({ phone, email, fullName: input.fullName, passwordHash, termsVersion: input.termsVersion });
    return this.tokens.issue(user.id, meta);
  }

  async signInWithPassword(emailInput: string, password: string, meta: Meta): Promise<IssuedTokens> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
    if (!user || !user.passwordHash || !ok) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }
    this.assertActive(user.status);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.tokens.issue(user.id, meta);
  }

  async resetPassword(emailInput: string, code: string, newPassword: string): Promise<void> {
    const email = emailInput.trim().toLowerCase();
    await this.otp.verify(email, "reset_password", code);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // OTP was valid for an address with no account; nothing to do, reveal nothing
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), emailVerified: user.emailVerified ?? new Date() } }),
      // A password reset ends every existing session.
      this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async me(principal: Principal) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        profile: { select: { fullName: true, preferredLanguage: true } },
        roles: { select: { role: { select: { key: true } } } },
        memberships: {
          where: { status: "active" },
          select: { role: true, provider: { select: { id: true, slug: true, displayName: true, status: true } } },
        },
      },
    });
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.phoneVerified),
      fullName: user.profile?.fullName ?? null,
      preferredLanguage: user.profile?.preferredLanguage ?? "en",
      roles: user.roles.map((r) => r.role.key),
      permissions: [...principal.platformPermissions].sort(),
      providers: user.memberships.map((m) => ({ ...m.provider, role: m.role })),
    };
  }

  private assertActive(status: string) {
    if (status === "suspended" || status === "deleted") {
      throw ApiError.forbidden("This account is not active. Contact support for help.");
    }
  }

  private async createTraveler(data: {
    phone: string;
    email?: string | undefined;
    fullName: string;
    passwordHash?: string | null;
    termsVersion?: string | undefined;
  }) {
    return this.prisma.user.create({
      data: {
        phone: data.phone,
        phoneVerified: new Date(),
        email: data.email ?? null,
        passwordHash: data.passwordHash ?? null,
        profile: {
          create: {
            fullName: data.fullName,
            ...(data.termsVersion ? { consentVersion: data.termsVersion, consentedAt: new Date() } : {}),
          },
        },
        roles: { create: { role: { connect: { key: "traveler" } } } },
      },
    });
  }
}
