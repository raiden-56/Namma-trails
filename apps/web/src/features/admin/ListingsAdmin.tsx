"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { endpoints, type AdminListing } from "@/lib/api/endpoints";
import { adminOps, type ListingDecision } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { ReasonDialog } from "@/features/partner/ReasonDialog";
import { ADMIN_DENIED, QueryState } from "@/features/partner/shared";

const DECISIONS: Record<ListingDecision, { label: string; variant: "primary" | "secondary" | "danger"; needsMessage: boolean; help?: string }> = {
  approve: { label: "Approve", variant: "secondary", needsMessage: false },
  publish: { label: "Publish", variant: "primary", needsMessage: false },
  request_changes: { label: "Request changes", variant: "secondary", needsMessage: true, help: "The partner sees this message and updates the listing." },
  reject: { label: "Reject", variant: "danger", needsMessage: true, help: "The partner sees your reason." },
  pause: { label: "Pause", variant: "secondary", needsMessage: false },
};

function decisionsFor(status: string): ListingDecision[] {
  if (status === "pending_review") return ["publish", "approve", "request_changes", "reject"];
  if (status === "changes_requested") return ["approve", "reject"];
  if (status === "approved") return ["publish", "request_changes"];
  if (status === "published") return ["pause", "request_changes"];
  if (status === "paused") return ["publish"];
  return [];
}

const BLOCKER_TEXT: Record<string, string> = {
  provider_not_approved: "the partner is not approved yet",
  provider_documents_incomplete: "the partner's documents are not all verified",
  category_not_approved: "the partner is not approved for this category",
  category_not_enabled_in_destination: "this category is not enabled in the destination",
  asset_documents_incomplete: "boat or vehicle documents are not verified",
  listing_not_approved: "the listing is not approved",
};

function explain(error: Error): string {
  if (error instanceof ApiError && error.code === "PUBLISH_BLOCKED") {
    const blockers = ((error.details as { blockers?: string[] } | undefined)?.blockers ?? []).map((b) => BLOCKER_TEXT[b] ?? b.replace(/_/g, " "));
    return `Can't publish yet: ${blockers.join("; ")}.`;
  }
  return error.message;
}

export function ListingsAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const list = useQuery({ queryKey: ["admin", "listings"], queryFn: () => endpoints.adminListings({}), retry: false });
  const [pending, setPending] = useState<{ listing: AdminListing; decision: ListingDecision } | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const decide = useMutation({
    mutationFn: (v: { listing: AdminListing; decision: ListingDecision; message?: string }) => adminOps.decideListing(v.listing.id, v.decision, v.message),
    onSuccess: async (res, v) => {
      toast({ title: `${v.listing.title}: now ${res.data.status.replace(/_/g, " ")}`, tone: "success" });
      setPending(null);
      setRowError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e, v) => {
      if (!pending) setRowError({ id: v.listing.id, message: explain(e) });
    },
  });

  function choose(listing: AdminListing, decision: ListingDecision) {
    decide.reset();
    setRowError(null);
    if (DECISIONS[decision].needsMessage) setPending({ listing, decision });
    else decide.mutate({ listing, decision });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Listings</h1>
        <p className="text-sm text-fg-muted">Moderate what partners publish. A listing is bookable only once published, its partner is approved and its destination is live.</p>
      </div>
      <QueryState isPending={list.isPending} error={list.error} what="listings" deniedHint={ADMIN_DENIED}>
        {() => (
          <Table<AdminListing>
            caption="Listings"
            density="compact"
            rows={list.data!.data}
            getRowKey={(l) => l.id}
            columns={[
              {
                key: "title",
                header: "Listing",
                cell: (l) => (
                  <span className="flex flex-col">
                    <span className="font-semibold">{l.title}</span>
                    {l.isDemo ? (
                      <span>
                        <Badge tone="warning">Demo</Badge>
                      </span>
                    ) : null}
                    {rowError?.id === l.id ? (
                      <span role="alert" className="mt-1 rounded bg-danger/10 px-2 py-1 text-xs text-danger">
                        {rowError.message}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "provider",
                header: "Partner",
                cell: (l) => (
                  <span className="flex flex-col gap-1">
                    <span>{l.provider.displayName}</span>
                    <StatusChip kind="provider" status={l.provider.status} />
                  </span>
                ),
              },
              { key: "category", header: "Category", cell: (l) => l.category.name },
              { key: "destination", header: "Destination", cell: (l) => l.destination.name },
              { key: "price", header: "From", align: "right", cell: (l) => (l.fromPrice === null ? "—" : formatInrFromPaise(l.fromPrice)) },
              { key: "status", header: "Status", cell: (l) => <StatusChip kind="listing" status={l.status as "draft"} /> },
              {
                key: "actions",
                header: "Moderation",
                align: "right",
                cell: (l) => {
                  const options = decisionsFor(l.status);
                  if (options.length === 0) return <span className="text-fg-muted">—</span>;
                  return (
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {options.map((d) => (
                        <Button key={d} size="sm" variant={DECISIONS[d].variant === "danger" ? "secondary" : DECISIONS[d].variant} disabled={decide.isPending} onClick={() => choose(l, d)}>
                          {DECISIONS[d].label}
                        </Button>
                      ))}
                    </span>
                  );
                },
              },
            ]}
            empty={<EmptyState title="No listings yet" description="Listings partners create appear here for moderation." />}
          />
        )}
      </QueryState>

      <ReasonDialog
        open={Boolean(pending)}
        title={pending ? `${DECISIONS[pending.decision].label}: ${pending.listing.title}` : ""}
        description={pending ? DECISIONS[pending.decision].help : undefined}
        confirmLabel={pending ? DECISIONS[pending.decision].label : "Confirm"}
        variant={pending ? DECISIONS[pending.decision].variant : "primary"}
        minLength={10}
        reasonLabel="Message to the partner"
        busy={decide.isPending}
        error={decide.error ? explain(decide.error) : null}
        onClose={() => setPending(null)}
        onConfirm={(message) => pending && decide.mutate({ listing: pending.listing, decision: pending.decision, message })}
      />
    </div>
  );
}
