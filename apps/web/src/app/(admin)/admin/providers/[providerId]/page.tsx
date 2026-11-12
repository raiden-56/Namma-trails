import type { Metadata } from "next";
import { ProviderReview } from "@/features/admin/ProviderReview";

export const metadata: Metadata = { title: "Review application" };

export default async function ProviderReviewPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  return <ProviderReview providerId={providerId} />;
}
