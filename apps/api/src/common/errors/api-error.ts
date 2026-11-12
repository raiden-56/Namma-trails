import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Every error response uses one envelope:
 *   { "error": { "code": "PROVIDER_NOT_FOUND", "message": "…", "details": {…}, "requestId": "…" } }
 */
export interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super({ error: { code, message, ...(details === undefined ? {} : { details }) } } satisfies ErrorBody, status);
  }

  static notFound(entity: string) {
    return new ApiError(HttpStatus.NOT_FOUND, `${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found`);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new ApiError(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
  }
  static unauthorized(message = "Sign in to continue") {
    return new ApiError(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", message);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(HttpStatus.CONFLICT, code, message, details);
  }
  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiError(HttpStatus.BAD_REQUEST, code, message, details);
  }
}
