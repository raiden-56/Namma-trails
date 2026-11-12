"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints, type AdminDestination } from "@/lib/api/endpoints";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Choice";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";

const ACTION_LABEL: Record<AdminDestination["status"], string> = {
  draft: "Move back to draft",
  onboarding: "Open to partners",
  active: "Launch (make bookable)",
  temporarily_unavailable: "Take offline",
};

export function DestinationsAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const list = useQuery({ queryKey: ["admin", "destinations"], queryFn: endpoints.adminDestinations });

  const update = useMutation({
    mutationFn: (v: { slug: string; status?: AdminDestination["status"]; isFeatured?: boolean; reason?: string }) =>
      endpoints.adminUpdateDestination(v.slug, { ...(v.status ? { status: v.status } : {}), ...(v.isFeatured !== undefined ? { isFeatured: v.isFeatured } : {}), ...(v.reason ? { reason: v.reason } : {}) }),
    onSuccess: async (res) => {
      toast({ title: `${res.data.slug} updated: ${res.data.status.replace(/_/g, " ")}`, tone: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      await queryClient.invalidateQueries({ queryKey: ["destinations"] });
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, tone: "danger" }),
  });

  function changeStatus(d: AdminDestination, status: AdminDestination["status"]) {
    let reason: string | undefined;
    if (status === "active" && d.readiness.publishedListings === 0) {
      if (!window.confirm(`${d.name} has no live listings yet. Travellers will see the destination but nothing to book. Launch anyway?`)) return;
    }
    if (status === "temporarily_unavailable") {
      reason = window.prompt(`Why is ${d.name} going offline? (shown in the audit log)`)?.trim() || undefined;
      if (!reason) return;
    }
    update.mutate({ slug: d.slug, status, ...(reason ? { reason } : {}) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Destinations</h1>
        <p className="text-sm text-fg-muted">
          Launch destinations one at a time. Categories only show as bookable where verified partners have live listings.
        </p>
      </div>
      {list.isError ? (
        <ErrorState title="Couldn't load destinations" description={list.error.message} />
      ) : list.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <Table<AdminDestination>
          caption="Destinations"
          density="compact"
          rows={list.data.data}
          getRowKey={(d) => d.slug}
          columns={[
            {
              key: "name",
              header: "Destination",
              cell: (d) => (
                <span className="flex flex-col">
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-xs text-fg-muted">
                    {d.district} · phase {d.launchPhase}
                  </span>
                </span>
              ),
            },
            { key: "status", header: "Status", cell: (d) => <StatusChip kind="destination" status={d.status} /> },
            { key: "apps", header: "Partner applications", cell: (d) => d.readiness.partnerApplications, align: "right" },
            { key: "approved", header: "Approved partners", cell: (d) => d.readiness.approvedPartners, align: "right" },
            { key: "listings", header: "Live listings", cell: (d) => d.readiness.publishedListings, align: "right" },
            {
              key: "featured",
              header: "Featured",
              cell: (d) => (
                <Switch
                  label={`Feature ${d.name} on the homepage`}
                  checked={d.isFeatured}
                  disabled={update.isPending}
                  onCheckedChange={(next) => update.mutate({ slug: d.slug, isFeatured: next })}
                />
              ),
            },
            {
              key: "actions",
              header: "Change status",
              cell: (d) => (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {d.allowedStatuses.map((s) => (
                    <Button key={s} size="sm" variant={s === "active" ? "primary" : "secondary"} disabled={update.isPending} onClick={() => changeStatus(d, s)}>
                      {ACTION_LABEL[s]}
                    </Button>
                  ))}
                </span>
              ),
              align: "right",
            },
          ]}
        />
      )}
    </div>
  );
}
