import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ENV, type Env } from "../../config/env.js";
import { ApiError } from "../../common/errors/api-error.js";
import { PrismaService } from "../../prisma/prisma.service.js";

export interface AccessClaims {
  sub: string;
  sid: string;
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Short-lived JWT access tokens + opaque rotating refresh tokens.
 * Refresh tokens are stored hashed; presenting a revoked (already rotated)
 * token revokes the whole session family, which defeats token replay.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async verifyAccessToken(token: string): Promise<AccessClaims | null> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, { secret: this.env.JWT_ACCESS_SECRET, algorithms: ["HS256"] });
      return typeof claims.sub === "string" ? claims : null;
    } catch {
      return null;
    }
  }

  async issue(userId: string, meta: { userAgent?: string; ip?: string }, familyId: string = randomUUID()): Promise<IssuedTokens> {
    const refreshToken = randomBytes(32).toString("base64url");
    const refreshTokenExpiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const session = await this.prisma.session.create({
      data: {
        userId,
        familyId,
        refreshTokenHash: sha256(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
        ipAddress: meta.ip ?? null,
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: session.id } satisfies AccessClaims, {
      secret: this.env.JWT_ACCESS_SECRET,
      algorithm: "HS256",
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
    });
    return { accessToken, accessTokenExpiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS, refreshToken, refreshTokenExpiresAt };
  }

  async rotate(refreshToken: string, meta: { userAgent?: string; ip?: string }): Promise<IssuedTokens> {
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
    if (!session) throw ApiError.unauthorized();
    if (session.revokedAt) {
      // Reuse of a rotated token: assume theft and end every session in the family.
      await this.prisma.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw ApiError.unauthorized("Please sign in again");
    }
    if (session.expiresAt < new Date()) throw ApiError.unauthorized("Please sign in again");
    const { count } = await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count !== 1) throw ApiError.unauthorized("Please sign in again"); // lost a concurrent rotation race
    return this.issue(session.userId, meta, session.familyId);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { refreshTokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
