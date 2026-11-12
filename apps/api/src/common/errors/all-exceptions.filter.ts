import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { DomainError } from "@kt/domain";
import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import type { ErrorBody } from "./api-error.js";

/** Domain error codes that represent a conflict with current state rather than bad input. */
const CONFLICT_CODES = new Set(["BOOKING_INVALID_TRANSITION", "PROVIDER_INVALID_TRANSITION", "INVENTORY_UNAVAILABLE"]);
/** Connection/authentication failures: the database is unreachable, not the request at fault. */
const DB_UNAVAILABLE_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1017", "P2024", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"]);

/** Walks the error and its cause chain (driver adapters wrap pg/network errors). */
function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && DB_UNAVAILABLE_CODES.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: string }>();
    const requestId = typeof req.id === "string" ? req.id : undefined;

    const { status, body } = this.toResponse(exception);
    body.error.requestId = requestId;
    if (status >= 500) {
      this.logger.error({ err: exception, requestId, path: req.url }, "Unhandled error");
    }
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      const status = CONFLICT_CODES.has(exception.code) ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY;
      return { status, body: { error: { code: exception.code, message: exception.message, details: exception.details } } };
    }
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute and try again." } },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "object") {
        return { status, body: payload as ErrorBody };
      }
      const message = typeof payload === "string" ? payload : ((payload as { message?: string }).message ?? exception.message);
      return { status, body: { error: { code: HttpStatus[status] ?? "HTTP_ERROR", message: String(message) } } };
    }
    if (isDatabaseUnavailable(exception)) {
      return { status: HttpStatus.SERVICE_UNAVAILABLE, body: { error: { code: "SERVICE_UNAVAILABLE", message: "We're having trouble reaching our servers. Please try again shortly." } } };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return { status: HttpStatus.CONFLICT, body: { error: { code: "ALREADY_EXISTS", message: "A record with these details already exists" } } };
      }
      if (exception.code === "P2025") {
        return { status: HttpStatus.NOT_FOUND, body: { error: { code: "NOT_FOUND", message: "Record not found" } } };
      }
    }
    // Never leak internals (SQL, stack traces) to clients.
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } } };
  }
}
