"use client";

import { useMutation } from "@tanstack/react-query";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { CheckCircle2, FileText } from "lucide-react";
import { destinations } from "@/content/destinations";
import { ApiError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ServiceCategoryKey } from "@/lib/catalog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { businessTypeOptions, documentChecklist, providerCategoryOptions, TERMS_VERSION } from "./options";
import type { RegistrationValues } from "./schema";

function useStepForm() {
  return useFormContext<RegistrationValues>();
}

export function StepAccount() {
  const { register, formState } = useStepForm();
  const e = formState.errors.account;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id="fullName" label="Full name" required error={e?.fullName?.message} className="sm:col-span-2">
        <Input autoComplete="name" {...register("account.fullName")} />
      </Field>
      <Field id="email" label="Business email" required error={e?.email?.message}>
        <Input type="email" autoComplete="email" {...register("account.email")} />
      </Field>
      <Field id="phone" label="Mobile number" required hint="We'll send a one-time code to verify it." error={e?.phone?.message}>
        <Input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98XXXXXXXX" {...register("account.phone")} />
      </Field>
      <Field id="password" label="Password" required hint="At least 10 characters with a letter and a number." error={e?.password?.message}>
        <Input type="password" autoComplete="new-password" {...register("account.password")} />
      </Field>
      <Field id="confirmPassword" label="Confirm password" required error={e?.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...register("account.confirmPassword")} />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox
          label="I accept the partner agreement and terms of use"
          description="Draft terms — final terms will be published after legal review, before launch."
          {...register("account.acceptTerms")}
        />
        {e?.acceptTerms?.message ? (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            {e.acceptTerms.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function StepOtp() {
  const { register, setValue, getValues, control, formState } = useStepForm();
  const phone = useWatch({ control, name: "account.phone" });
  const requested = useWatch({ control, name: "otp.requested" });
  const verified = useWatch({ control, name: "otp.verified" });

  const request = useMutation({
    mutationFn: () => endpoints.requestOtp({ channel: "sms", destination: `+91${getValues("account.phone")}`, purpose: "sign_up" }),
    onSuccess: () => setValue("otp.requested", true),
  });
  // Verifying the code creates the partner's user account and signs them in.
  const verify = useMutation({
    mutationFn: () => {
      const a = getValues("account");
      return endpoints.signUp({ fullName: a.fullName, phone: `+91${a.phone}`, email: a.email, password: a.password, otpCode: getValues("otp.code"), termsVersion: TERMS_VERSION });
    },
    onSuccess: () => setValue("otp.verified", true, { shouldValidate: true }),
  });
  const accountExists = verify.error instanceof ApiError && verify.error.code === "ACCOUNT_EXISTS";

  if (verified) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-success/10 p-4 font-semibold text-success" role="status">
        <CheckCircle2 className="size-5" aria-hidden="true" /> +91 {phone} is verified and your account is ready.
      </p>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-5">
      <p className="text-fg-muted">
        We&apos;ll send a 6-digit code to <span className="font-semibold text-fg">+91 {phone}</span>.
      </p>
      {!requested ? (
        <Button onClick={() => request.mutate()} loading={request.isPending} className="self-start">
          Send code
        </Button>
      ) : (
        <div className="flex items-end gap-3">
          <Field id="otpCode" label="Verification code" className="flex-1">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...register("otp.code")} />
          </Field>
          <Button onClick={() => verify.mutate()} loading={verify.isPending}>
            Verify
          </Button>
        </div>
      )}
      {request.error || verify.error ? (
        <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
          {(request.error ?? verify.error)?.message}{" "}
          {accountExists ? (
            <a href="/sign-in?as=partner" className="font-semibold underline">
              Sign in to continue your application
            </a>
          ) : null}
        </p>
      ) : null}
      {requested ? (
        <Button variant="link" onClick={() => request.mutate()} disabled={request.isPending} className="self-start">
          Resend code
        </Button>
      ) : null}
      {formState.errors.otp?.verified?.message ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {formState.errors.otp.verified.message}
        </p>
      ) : null}
    </div>
  );
}

export function StepBusiness() {
  const { register, control, formState } = useStepForm();
  // The dropdown is not a native form element, so the form library drives it through a controller.
  const businessType = useController({ name: "business.businessType", control }).field;
  const e = formState.errors.business;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id="businessName" label="Business or brand name" required error={e?.name?.message}>
        <Input autoComplete="organization" {...register("business.name")} />
      </Field>
      <Field id="businessType" label="Business type" required error={e?.businessType?.message}>
        <Select
          ref={businessType.ref}
          value={businessType.value ?? ""}
          onValueChange={businessType.onChange}
          onBlur={businessType.onBlur}
          placeholder="Choose…"
          options={businessTypeOptions}
        />
      </Field>
      <Field id="description" label="Describe your business" required hint="What you offer, since when, and what makes it special." error={e?.description?.message} className="sm:col-span-2">
        <Textarea rows={5} {...register("business.description")} />
      </Field>
      <Field id="registrationNumber" label="Business registration number" hint="GSTIN, trade licence or similar, if you have one." error={e?.registrationNumber?.message}>
        <Input {...register("business.registrationNumber")} />
      </Field>
      <Field id="website" label="Website or social page" hint="Optional" error={e?.website?.message}>
        <Input type="url" inputMode="url" placeholder="https://" {...register("business.website")} />
      </Field>
    </div>
  );
}

export function StepCategories() {
  const { register, formState } = useStepForm();
  return (
    <fieldset>
      <legend className="mb-4 text-fg-muted">Choose every service you offer. You can add more later — one account covers all of them.</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {providerCategoryOptions.map((o) => (
          <Checkbox
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            className="rounded-lg border border-line-strong p-3 has-checked:border-fg has-checked:bg-fg/4"
            {...register("categories")}
          />
        ))}
      </div>
      {formState.errors.categories?.message ? (
        <p role="alert" className="mt-3 text-xs font-medium text-danger">
          {formState.errors.categories.message}
        </p>
      ) : null}
    </fieldset>
  );
}

export function StepLocation() {
  const { register, formState } = useStepForm();
  const e = formState.errors.location;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id="addressLine" label="Business address" required error={e?.addressLine?.message} className="sm:col-span-2">
        <Input autoComplete="street-address" {...register("location.addressLine")} />
      </Field>
      <Field id="city" label="Town or city" required error={e?.city?.message}>
        <Input autoComplete="address-level2" {...register("location.city")} />
      </Field>
      <Field id="district" label="District" required error={e?.district?.message}>
        <Input {...register("location.district")} />
      </Field>
      <Field id="state" label="State" required error={e?.state?.message}>
        <Input readOnly {...register("location.state")} />
      </Field>
      <Field id="pincode" label="PIN code" required error={e?.pincode?.message}>
        <Input inputMode="numeric" maxLength={6} autoComplete="postal-code" {...register("location.pincode")} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">Where do you operate?</legend>
        <div className="flex flex-wrap gap-x-6">
          {destinations.map((d) => (
            <Checkbox key={d.slug} value={d.slug} label={d.name} {...register("location.operatingDestinations")} />
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-muted">Map pin selection becomes available once a map provider is configured; your exact location is confirmed during verification.</p>
        {e?.operatingDestinations?.message ? (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            {e.operatingDestinations.message}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

export function DocumentChecklist({ categories }: { categories: ServiceCategoryKey[] }) {
  const docs = Array.from(new Set(categories.flatMap((c) => documentChecklist[c] ?? [])));
  if (docs.length === 0) return <p className="text-fg-muted">Choose your service categories to see the documents you&apos;ll need.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {docs.map((doc) => (
        <li key={doc} className="flex items-start gap-3 rounded-md border border-line bg-surface-raised p-3 text-sm">
          <FileText className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
          {doc}
        </li>
      ))}
    </ul>
  );
}

export function StepDocuments() {
  const { register, control, formState } = useStepForm();
  const categories = (useWatch({ control, name: "categories" }) ?? []) as ServiceCategoryKey[];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-fg-muted">
        After you submit, you&apos;ll upload these securely from your partner portal. Documents are private — only our verification team can view them.
        Requirements can vary by location; the portal shows the exact list for your categories.
      </p>
      <DocumentChecklist categories={categories} />
      <div>
        <Checkbox label="I have these documents ready, or know how to get them" {...register("documentsAcknowledged")} />
        {formState.errors.documentsAcknowledged?.message ? (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            {formState.errors.documentsAcknowledged.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function StepReview() {
  const { getValues } = useStepForm();
  const v = getValues();
  const cats = providerCategoryOptions.filter((o) => (v.categories ?? []).includes(o.value)).map((o) => o.label);
  const rows: Array<[string, string]> = [
    ["Name", v.account?.fullName ?? ""],
    ["Email", v.account?.email ?? ""],
    ["Mobile", `+91 ${v.account?.phone ?? ""}`],
    ["Business", v.business?.name ?? ""],
    ["Type", businessTypeOptions.find((b) => b.value === v.business?.businessType)?.label ?? ""],
    ["Categories", cats.join(", ")],
    ["Address", [v.location?.addressLine, v.location?.city, v.location?.district, v.location?.pincode].filter(Boolean).join(", ")],
    ["Operates in", (v.location?.operatingDestinations ?? []).map((s) => destinations.find((d) => d.slug === s)?.name ?? s).join(", ")],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      {rows.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-sm text-fg-muted">{k}</dt>
          <dd className="font-medium">{val || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
