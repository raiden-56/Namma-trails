import { env } from "@/lib/env";
import { getAccessToken, setAccessToken } from "./session";

/** Error envelope returned by the API: { error: { code, message, details } }. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the API could not be reached at all (network down, CORS, server not running). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  query?: Query;
  body?: unknown;
  /** Idempotency key for booking/payment creation. */
  idempotencyKey?: string;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiErrorBody).error?.message === "string"
  );
}

const SESSION_ENDPOINT = /^\/auth\/(refresh|sign-in|sign-up|sign-out|otp\/|password\/)/;

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(buildUrl("/auth/refresh"), { method: "POST", credentials: "include", headers: { Accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const body = (await res.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** Typed fetch wrapper. Never fabricates responses: failures surface as ApiError. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { query, body, idempotencyKey, headers, ...init } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined && !(body instanceof FormData)) finalHeaders.set("Content-Type", "application/json");
  if (idempotencyKey) finalHeaders.set("Idempotency-Key", idempotencyKey);
  const token = getAccessToken();
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      credentials: "include",
      ...init,
      headers: finalHeaders,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(
      0,
      "NETWORK_UNAVAILABLE",
      "We could not reach the server. Check your connection and try again.",
      cause instanceof Error ? cause.message : undefined,
    );
  }

  // One silent refresh-and-retry for a missing/expired access token (e.g. after a page reload).
  // Not for endpoints that create or end a session: a 401 there is the real answer.
  if (response.status === 401 && !retried && !SESSION_ENDPOINT.test(path) && (await refreshSession())) {
    return apiFetch<T>(path, options, true);
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError(response.status, payload.error.code, payload.error.message, payload.error.details);
    }
    throw new ApiError(response.status, "HTTP_ERROR", `Request failed with status ${response.status}.`);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};
