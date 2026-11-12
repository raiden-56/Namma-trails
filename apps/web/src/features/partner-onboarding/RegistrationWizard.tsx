"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, PartyPopper } from "lucide-react";
import type { ProviderBusinessInput } from "@kt/domain";
import { endpoints } from "@/lib/api/endpoints";
import type { ProviderBusinessType, ServiceCategoryKey } from "@/lib/catalog";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/States";
import { OPERATING_STATE } from "./options";
import { registrationSchema, stepFields, type RegistrationValues, type StepId } from "./schema";
import { StepAccount, StepBusiness, StepCategories, StepDocuments, StepLocation, StepOtp, StepReview } from "./steps";

const steps: Array<{ id: StepId; label: string; title: string; Component: () => React.JSX.Element }> = [
  { id: "account", label: "Account", title: "Create your partner account", Component: StepAccount },
  { id: "otp", label: "Verify", title: "Verify your mobile number", Component: StepOtp },
  { id: "business", label: "Business", title: "Tell us about your business", Component: StepBusiness },
  { id: "categories", label: "Services", title: "What do you offer?", Component: StepCategories },
  { id: "location", label: "Location", title: "Where are you based?", Component: StepLocation },
  { id: "documents", label: "Documents", title: "Documents you'll need", Component: StepDocuments },
  { id: "review", label: "Submit", title: "Review and submit", Component: StepReview },
];

function toBusiness(v: RegistrationValues): ProviderBusinessInput {
  return {
    legalName: v.business.name,
    displayName: v.business.name,
    businessType: v.business.businessType as ProviderBusinessType,
    description: v.business.description,
    registrationNumber: v.business.registrationNumber || undefined,
    website: v.business.website || undefined,
    contactPhone: `+91${v.account.phone}`,
    contactEmail: v.account.email,
    address: {
      line1: v.location.addressLine,
      city: v.location.city,
      district: v.location.district,
      state: v.location.state,
      pincode: v.location.pincode,
    },
  };
}

export function RegistrationWizard() {
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
    defaultValues: {
      account: { fullName: "", email: "", phone: "", password: "", confirmPassword: "" },
      otp: { requested: false, code: "" },
      business: { name: "", businessType: "", description: "", registrationNumber: "", website: "" },
      categories: [],
      location: { addressLine: "", city: "", district: "", state: OPERATING_STATE, pincode: "", operatingDestinations: [] },
    },
  });

  // Remember the created application so a retry after a partial failure never creates a duplicate.
  const providerIdRef = useRef<string | null>(null);
  const submit = useMutation({
    mutationFn: async (values: RegistrationValues) => {
      if (!providerIdRef.current) {
        const created = await endpoints.createProviderApplication(toBusiness(values));
        providerIdRef.current = created.data.id;
      }
      const { data } = await endpoints.setProviderScope(providerIdRef.current, {
        categoryKeys: values.categories as ServiceCategoryKey[],
        destinationSlugs: values.location.operatingDestinations,
      });
      return data;
    },
  });

  const step = steps[index] ?? steps[0]!;
  const isLast = index === steps.length - 1;
  const verified = form.watch("otp.verified") === true;

  function goTo(next: number) {
    setIndex(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function next() {
    const ok = await form.trigger([...stepFields[step.id]] as Parameters<typeof form.trigger>[0], { shouldFocus: true });
    if (ok) goTo(index + 1);
  }

  if (submit.isSuccess) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-2xl border border-line bg-surface-raised p-8" role="status">
        <PartyPopper className="size-8 text-accent-text" aria-hidden="true" />
        <h2 className="font-display text-display-sm">Application saved</h2>
        <p className="max-w-prose text-fg-muted">
          <strong>{submit.data.displayName}</strong> is saved as a <strong>{submit.data.status}</strong> application. Next, upload the{" "}
          {submit.data.requirements.missing.length} required document{submit.data.requirements.missing.length === 1 ? "" : "s"} from your partner
          portal and submit for verification. Your listings stay unpublished until verification is complete.
        </p>
        <Button href="/partner">Go to partner portal</Button>
      </div>
    );
  }

  const { Component } = step;

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => submit.mutate(values))}
        className="flex flex-col gap-8 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-8"
      >
        <Stepper steps={steps.map((s) => ({ id: s.id, label: s.label }))} current={index} />
        <div className="flex flex-col gap-6">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-display-sm focus:outline-none">
            {step.title}
          </h2>
          <Component />
        </div>

        {submit.isError ? (
          <ErrorState
            title="We couldn't submit your application"
            description={submit.error.message}
            action={
              <Button type="submit" variant="secondary" size="sm" loading={submit.isPending}>
                Try again
              </Button>
            }
          />
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
          <Button variant="ghost" leadingIcon={<ArrowLeft className="size-4" />} onClick={() => goTo(index - 1)} disabled={index === 0 || (verified && index <= 2)}>
            Back
          </Button>
          {/* Distinct keys force separate DOM buttons. Without them React reuses one <button> and flips
              type="button" → "submit" during the Continue click, which auto-submits the review step. */}
          {isLast ? (
            <Button key="submit" type="submit" loading={submit.isPending}>
              Submit application
            </Button>
          ) : (
            <Button key="continue" type="button" onClick={() => void next()} trailingIcon={<ArrowRight className="size-4" />}>
              Continue
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
