import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-display-md">Saved</h1>
      <EmptyState
        icon={<Heart className="size-5" />}
        title="Nothing saved yet"
        description="Sign in to save services and destinations you like, and find them here when you are ready to book."
        action={<Button href="/sign-in">Sign in</Button>}
      />
    </div>
  );
}
