import { Compass } from "lucide-react";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="main" className="container-editorial flex min-h-dvh flex-col justify-center gap-8 py-16">
      <Wordmark />
      <div className="flex max-w-2xl flex-col gap-5">
        <Compass className="size-10 text-accent-text" aria-hidden="true" />
        <h1 className="font-display text-display-xl">This path isn&apos;t on the map.</h1>
        <p className="text-lead text-fg-muted">The page may have moved, or the listing is no longer published.</p>
        <div className="flex flex-wrap gap-3">
          <Button href="/">Back to home</Button>
          <Button href="/destinations" variant="secondary">
            Browse destinations
          </Button>
        </div>
      </div>
    </main>
  );
}
