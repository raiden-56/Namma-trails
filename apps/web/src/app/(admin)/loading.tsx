import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-fg-muted">
      <Spinner className="text-2xl" label="Loading page" />
    </div>
  );
}
