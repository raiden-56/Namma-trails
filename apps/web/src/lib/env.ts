/** Public runtime configuration. Only NEXT_PUBLIC_* values are allowed here. */
export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, ""),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
} as const;
