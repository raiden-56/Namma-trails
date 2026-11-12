import { z } from "zod";

/* Client-side validation for the provider registration wizard. The API re-validates everything. */

const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number (without +91).");

export const registrationSchema = z
  .object({
    account: z.object({
      fullName: z.string().trim().min(2, "Enter your full name."),
      email: z.email("Enter a valid business email."),
      phone,
      password: z
        .string()
        .min(10, "Use at least 10 characters.")
        .regex(/[A-Za-z]/, "Include at least one letter.")
        .regex(/\d/, "Include at least one number."),
      confirmPassword: z.string(),
      acceptTerms: z.literal(true, { error: "You need to accept the partner terms to continue." }),
    })
    // Scoped to `account` so it runs as soon as this step is valid (Zod skips refinements
    // while the object it is attached to still has issues).
    .refine((a) => a.password === a.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." }),
    /** The OTP step creates the account (POST /auth/sign-up), so the code is used while it is still valid. */
    otp: z.object({
      requested: z.boolean(),
      code: z.string(),
      verified: z.literal(true, { error: "Verify your mobile number to continue." }),
    }),
    business: z.object({
      name: z.string().trim().min(2, "Enter your business or brand name."),
      businessType: z.string().min(1, "Choose a business type."),
      description: z.string().trim().min(40, "Describe your business in at least 40 characters."),
      registrationNumber: z.string().trim().optional(),
      website: z.union([z.literal(""), z.url("Enter a full URL, e.g. https://…")]).optional(),
    }),
    categories: z.array(z.string()).min(1, "Choose at least one service category."),
    location: z.object({
      addressLine: z.string().trim().min(5, "Enter your business address."),
      city: z.string().trim().min(2, "Enter your town or city."),
      district: z.string().trim().min(2, "Enter your district."),
      state: z.string().trim().min(2),
      pincode: z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN code."),
      operatingDestinations: z.array(z.string()).min(1, "Choose at least one destination you operate in."),
    }),
    documentsAcknowledged: z.literal(true, { error: "Confirm that you have these documents ready." }),
  });

export type RegistrationValues = z.input<typeof registrationSchema>;

export const stepFields = {
  account: ["account.fullName", "account.email", "account.phone", "account.password", "account.confirmPassword", "account.acceptTerms"],
  otp: ["otp.verified"],
  business: ["business.name", "business.businessType", "business.description", "business.registrationNumber", "business.website"],
  categories: ["categories"],
  location: ["location.addressLine", "location.city", "location.district", "location.state", "location.pincode", "location.operatingDestinations"],
  documents: ["documentsAcknowledged"],
  review: [],
} as const;

export type StepId = keyof typeof stepFields;
