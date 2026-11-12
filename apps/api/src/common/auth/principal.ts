import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Permission, Principal } from "@kt/domain";

export const IS_PUBLIC = "auth:isPublic";
export const REQUIRED_PERMISSIONS = "auth:requiredPermissions";

/** Route needs no authentication (a valid token, if sent, is still parsed). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Route requires every listed platform/self permission. Organisation-scoped
 * permissions (org.*) are checked in services against the target provider,
 * because they depend on which provider the resource belongs to.
 */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

export interface AuthedRequest {
  principal?: Principal;
}

export const CurrentPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().principal;
});
