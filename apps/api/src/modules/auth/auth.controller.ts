import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { emailSignInSchema, otpRequestSchema, password, type Principal } from "@kt/domain";
import type { Request, Response } from "express";
import { z } from "zod";
import { CurrentPrincipal, Public } from "../../common/auth/principal.js";
import { ApiError } from "../../common/errors/api-error.js";
import { ZodPipe } from "../../common/validation/zod.js";
import { ENV, type Env } from "../../config/env.js";
import { AuthService } from "./auth.service.js";
import type { IssuedTokens } from "./token.service.js";
import { TokenService } from "./token.service.js";

const REFRESH_COOKIE = "kt_rt";

/**
 * Per-IP limits per minute. Decorators are evaluated at import time, so these read
 * process.env directly (validated again in config/env.ts). Production defaults are strict.
 */
const AUTH_STRICT_LIMIT = Number(process.env.AUTH_OTP_RATE_LIMIT_PER_MINUTE ?? 5); // OTP send, sign-up, password reset
const AUTH_LOGIN_LIMIT = Number(process.env.AUTH_SIGNIN_RATE_LIMIT_PER_MINUTE ?? 10); // sign-in attempts
const REFRESH_PATH = "/api/v1/auth";

const otpCode = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
const phoneSignInSchema = z.object({ phone: z.string().min(10).max(16), code: otpCode, fullName: z.string().trim().min(2).max(120).optional() });
const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().min(10).max(16),
  email: z.email().optional(),
  password: password.optional(),
  otpCode,
  /** Version of the terms/privacy notice the user accepted (DPDP consent record). */
  termsVersion: z.string().trim().max(32).optional(),
});
const resetSchema = z.object({ email: z.email(), code: otpCode, newPassword: password });

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private meta(req: Request) {
    return { userAgent: req.headers["user-agent"], ip: req.ip };
  }

  /** Access token in the body (kept in memory by the client); refresh token only in an httpOnly cookie. */
  private respond(res: Response, t: IssuedTokens, extra: Record<string, unknown> = {}) {
    res.cookie(REFRESH_COOKIE, t.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV !== "development" && this.env.NODE_ENV !== "test",
      sameSite: "strict",
      path: REFRESH_PATH,
      expires: t.refreshTokenExpiresAt,
    });
    return { accessToken: t.accessToken, expiresIn: t.accessTokenExpiresIn, ...extra };
  }

  /** Cookie-authenticated endpoints additionally require an allowed Origin (CSRF defence in depth). */
  private assertOrigin(req: Request) {
    const origin = req.headers.origin;
    const allowed = this.env.CORS_ORIGINS.split(",").map((o) => o.trim());
    if (origin && !allowed.includes(origin)) throw ApiError.forbidden("Origin not allowed");
  }

  @Public()
  @Throttle({ default: { limit: AUTH_STRICT_LIMIT, ttl: 60_000 } })
  @Post("otp/request")
  @HttpCode(202)
  @ApiOperation({ summary: "Send a one-time code by SMS or email" })
  requestOtp(@Body(new ZodPipe(otpRequestSchema)) body: z.infer<typeof otpRequestSchema>, @Req() req: Request) {
    return this.auth.requestOtp(body.channel, body.destination, body.purpose, req.ip);
  }

  @Public()
  @Throttle({ default: { limit: AUTH_LOGIN_LIMIT, ttl: 60_000 } })
  @Post("otp/sign-in")
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in (or create a traveler account) with a phone OTP" })
  async phoneSignIn(@Body(new ZodPipe(phoneSignInSchema)) body: z.infer<typeof phoneSignInSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { isNewUser, ...tokens } = await this.auth.signInWithPhoneOtp(body.phone, body.code, body.fullName, this.meta(req));
    return this.respond(res, tokens, { isNewUser });
  }

  @Public()
  @Throttle({ default: { limit: AUTH_STRICT_LIMIT, ttl: 60_000 } })
  @Post("sign-up")
  @ApiOperation({ summary: "Create an account with a verified phone and optional email/password" })
  async signUp(@Body(new ZodPipe(signUpSchema)) body: z.infer<typeof signUpSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.signUp(body, this.meta(req)));
  }

  @Public()
  @Throttle({ default: { limit: AUTH_LOGIN_LIMIT, ttl: 60_000 } })
  @Post("sign-in")
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in with email and password" })
  async signIn(@Body(new ZodPipe(emailSignInSchema)) body: z.infer<typeof emailSignInSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.signInWithPassword(body.email, body.password, this.meta(req)));
  }

  @Public()
  @Throttle({ default: { limit: AUTH_STRICT_LIMIT, ttl: 60_000 } })
  @Post("password/reset")
  @HttpCode(204)
  @ApiOperation({ summary: "Reset a password with an emailed reset_password OTP" })
  async reset(@Body(new ZodPipe(resetSchema)) body: z.infer<typeof resetSchema>) {
    await this.auth.resetPassword(body.email, body.code, body.newPassword);
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate the refresh cookie and get a new access token" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertOrigin(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (!token) throw ApiError.unauthorized();
    return this.respond(res, await this.tokens.rotate(token, this.meta(req)));
  }

  @Public()
  @Post("sign-out")
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertOrigin(req);
    const token = readCookie(req, REFRESH_COOKIE);
    if (token) await this.tokens.revoke(token);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal);
  }
}
