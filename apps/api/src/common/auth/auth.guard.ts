import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { can, type Permission } from "@kt/domain";
import type { Request } from "express";
import { TokenService } from "../../modules/auth/token.service.js";
import { ApiError } from "../errors/api-error.js";
import { type AuthedRequest, IS_PUBLIC, REQUIRED_PERMISSIONS } from "./principal.js";
import { PrincipalService } from "./principal.service.js";

/**
 * Global guard: authenticates every request (deny by default), then enforces
 * @RequirePermissions. Routes opt out of authentication only with @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & AuthedRequest>();
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;

    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (token) {
      const claims = await this.tokens.verifyAccessToken(token);
      if (!claims && !isPublic) throw ApiError.unauthorized("Your session has expired. Please sign in again.");
      if (claims) {
        const principal = await this.principals.load(claims.sub);
        if (!principal && !isPublic) throw ApiError.unauthorized("This account is not active");
        if (principal) req.principal = principal;
      }
    }
    if (isPublic) return true;
    if (!req.principal) throw ApiError.unauthorized();

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, targets) ?? [];
    for (const p of required) {
      if (!can(req.principal, p)) throw ApiError.forbidden();
    }
    return true;
  }
}
