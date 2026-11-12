import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-display-md">Account</h1>
      <EmptyState
        icon={<UserRound className="size-5" />}
        title="Sign in to manage your account"
        description="Profile, saved travellers, emergency contacts, payment history, invoices and support tickets live here."
        action={<Button href="/sign-in">Sign in</Button>}
      />
    </div>
  );
}
