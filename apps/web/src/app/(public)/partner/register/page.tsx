import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationWizard } from "@/features/partner-onboarding/RegistrationWizard";
import { Breadcrumbs } from "@/components/ui/Navigation";

export const metadata: Metadata = {
  title: "Register your business",
  description: "Create your partner account, verify your mobile number and submit your business for verification.",
  alternates: { canonical: "/partner/register" },
};

export default function PartnerRegisterPage() {
  return (
    <div className="container-editorial grid gap-10 py-10 lg:grid-cols-12 lg:py-12">
      <div className="flex flex-col gap-5 lg:col-span-4">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Partners", href: "/partner/join" }, { label: "Register" }]} />
        <h1 className="font-display text-display-lg">Register your business</h1>
        <p className="text-fg-muted">Takes about 10 minutes. You can list services while verification is pending — they publish once you&apos;re approved.</p>
        <p className="text-sm text-fg-muted">
          Already registered?{" "}
          <Link href="/sign-in?as=partner" className="font-semibold text-accent-text underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
      <div className="lg:col-span-8">
        <RegistrationWizard />
      </div>
    </div>
  );
}
