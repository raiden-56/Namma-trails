import { z } from "zod";
import { PROVIDER_BUSINESS_TYPES, SERVICE_CATEGORY_KEYS } from "../catalog.js";

/** Indian mobile numbers in E.164 (+91 followed by 10 digits starting 6–9). */
export const indianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .transform((v) => (v.startsWith("+91") ? v : v.length === 10 ? `+91${v}` : v))
  .pipe(z.string().regex(/^\+91[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only");
export const pincode = z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");

export const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letters and numbers");

export const otpRequestSchema = z.object({
  channel: z.enum(["sms", "email"]),
  destination: z.string().trim().min(3).max(254),
  purpose: z.enum(["sign_in", "sign_up", "verify_phone", "verify_email", "reset_password"]),
});

export const otpVerifySchema = otpRequestSchema.extend({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const travelerSignUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254).optional(),
  phone: indianMobile,
  password: password.optional(),
});

export const emailSignInSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export const providerAccountSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  businessEmail: z.email().max(254),
  phone: indianMobile,
  password,
  acceptTerms: z.literal(true, { error: "You must accept the partner terms" }),
  acceptProviderAgreement: z.literal(true, { error: "You must accept the provider agreement" }),
});

export const addressSchema = z.object({
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100).default("Karnataka"),
  pincode,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const providerBusinessSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(120),
  businessType: z.enum(PROVIDER_BUSINESS_TYPES),
  description: z.string().trim().min(30, "Tell travelers a little more (30+ characters)").max(4000),
  registrationNumber: z.string().trim().max(60).optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN")
    .optional(),
  contactPhone: indianMobile,
  contactEmail: z.email(),
  website: z.url().optional(),
  address: addressSchema,
});

export const providerCategoriesSchema = z.object({
  categoryKeys: z.array(z.enum(SERVICE_CATEGORY_KEYS)).min(1, "Choose at least one service category"),
  /** Destination slugs (stable public identifiers, e.g. "gokarna"). */
  destinationSlugs: z.array(slug).min(1, "Choose at least one operating destination"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuerySchema = paginationSchema.extend({
  destination: slug.optional(),
  category: z.enum(SERVICE_CATEGORY_KEYS).optional(),
  q: z.string().trim().max(120).optional(),
  date: localDate.optional(),
  checkIn: localDate.optional(),
  checkOut: localDate.optional(),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  language: z.string().max(40).optional(),
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  radiusKm: z.coerce.number().min(0.5).max(100).optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating", "distance", "newest"]).default("relevance"),
});

export type ProviderAccountInput = z.infer<typeof providerAccountSchema>;
export type ProviderBusinessInput = z.infer<typeof providerBusinessSchema>;
export type ProviderCategoriesInput = z.infer<typeof providerCategoriesSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
