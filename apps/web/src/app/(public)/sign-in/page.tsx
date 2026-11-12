import type { Metadata } from "next";
import Link from "next/link";
import { SignInForms } from "@/features/auth/SignInForms";
import { MediaFrame } from "@/components/media/MediaFrame";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ as?: string; next?: string }> }) {
  const { as, next } = await searchParams;
  const partner = as === "partner";
  return (
    <div className="container-editorial grid gap-10 py-10 lg:grid-cols-2 lg:py-16">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{partner ? "Partner portal" : "Welcome back"}</p>
          <h1 className="font-display text-display-lg">Sign in</h1>
          <p className="text-fg-muted">{partner ? "Manage your listings, bookings and payouts." : "See your trips, bookings and saved places."}</p>
        </div>
        <SignInForms as={as} next={next} />
        <p className="text-sm text-fg-muted">
          {partner ? (
            <>
              New partner?{" "}
              <Link href="/partner/register" className="font-semibold text-accent-text underline underline-offset-4">
                Register your business
              </Link>
            </>
          ) : (
            <>New here? Signing in with your mobile number creates your account.</>
          )}
        </p>
      </div>
      <MediaFrame alt="Evening on the coast" scene="coast" aspect="aspect-[4/5]" className="hidden rounded-2xl lg:block" />
    </div>
  );
}
