"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook point for error monitoring (Sentry or similar) — configured in Phase 9.
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="container-editorial flex min-h-[60dvh] items-center py-16">
      <ErrorState
        className="max-w-xl"
        title="Something went wrong on this page"
        description={error.digest ? `Reference: ${error.digest}` : "Please try again."}
        action={
          <div className="flex gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button href="/" variant="secondary">
              Home
            </Button>
          </div>
        }
      />
    </main>
  );
}
