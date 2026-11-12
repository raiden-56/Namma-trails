/**
 * Access tokens live only in memory (never localStorage) to limit XSS impact.
 * After a reload the client silently obtains a new one from the httpOnly
 * refresh cookie via POST /auth/refresh.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
