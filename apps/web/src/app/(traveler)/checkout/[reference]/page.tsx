import type { Metadata } from "next";
import { Checkout } from "@/features/trips/Checkout";
import { RequireSignIn } from "@/features/trips/RequireSignIn";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return (
    <RequireSignIn>
      <Checkout reference={reference} />
    </RequireSignIn>
  );
}
