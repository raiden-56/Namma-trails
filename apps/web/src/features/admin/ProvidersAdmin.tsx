"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { endpoints, type AdminApplication } from "@/lib/api/endpoints";
import type { ProviderStatus } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Navigation";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";

const TABS: { key: string; label: string; status?: ProviderStatus | "all" }[] = [
  { key: "queue", label: "Review queue" },
  { key: "all", label: "All", status: "all" },
  { key: "draft", label: "Drafts", status: "draft" },
  { key: "info_requested", label: "Info requested", status: "info_requested" },
  { key: "approved", label: "Approved", status: "approved" },
  { key: "rejected", label: "Rejected", status: "rejected" },
  { key: "suspended", label: "Suspended", status: "suspended" },
];

const PAGE_SIZE = 20;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function ProvidersAdmin() {
  const params = useSearchParams();
  const pathname = usePathname();
  const tab = TABS.find((t) => t.key === params.get("tab")) ?? TABS[0]!;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  const list = useQuery({
    queryKey: ["admin", "applications", tab.key, page],
    queryFn: () => endpoints.adminApplications({ ...(tab.status ? { status: tab.status } : {}), page }),
    placeholderData: keepPreviousData,
  });
  const total = list.data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Provider applications</h1>
        <p className="text-sm text-fg-muted">Review partner businesses and their documents. Approval requires every required document to be verified.</p>
      </div>

      <nav aria-label="Application status" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "queue" ? pathname : `${pathname}?tab=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-semibold",
              t.key === tab.key ? "border-fg bg-fg text-surface" : "border-line-strong text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {list.isError ? (
        <ErrorState title="Couldn't load applications" description={list.error.message} />
      ) : list.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <Table<AdminApplication & { createdAt: string }>
          caption="Provider applications"
          density="compact"
          rows={list.data.data}
          getRowKey={(r) => r.id}
          columns={[
            {
              key: "business",
              header: "Business",
              cell: (r) => (
                <Link href={`/admin/providers/${r.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">
                  {r.displayName}
                </Link>
              ),
            },
            { key: "type", header: "Type", cell: (r) => r.businessType.replace(/_/g, " ") },
            { key: "categories", header: "Categories", cell: (r) => r.categories.map((c) => c.key.replace(/_/g, " ")).join(", ") || "—" },
            { key: "district", header: "District", cell: (r) => r.district },
            {
              key: "docs",
              header: "Docs to check",
              cell: (r) => (r.pendingDocuments > 0 ? <Badge tone="warning">{r.pendingDocuments}</Badge> : <span className="text-fg-muted">0</span>),
            },
            { key: "status", header: "Status", cell: (r) => <StatusChip kind="provider" status={r.status} /> },
            { key: "date", header: "Submitted", cell: (r) => (r.submittedAt ? fmtDate(r.submittedAt) : `Started ${fmtDate(r.createdAt)}`), align: "right" },
          ]}
          empty={
            <EmptyState
              title={tab.key === "queue" ? "Nothing waiting for review" : "No applications here"}
              description={
                tab.key === "queue"
                  ? "Applications appear in the queue once a partner uploads their documents and submits. Draft applications are under the Drafts tab."
                  : "No provider applications have this status."
              }
            />
          }
        />
      )}

      <p className="text-sm text-fg-muted" data-testid="applications-total">
        {list.data ? `${total} application${total === 1 ? "" : "s"}` : null}
      </p>
      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        hrefFor={(p) => `${pathname}?${new URLSearchParams({ ...(tab.key !== "queue" ? { tab: tab.key } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`}
      />
    </div>
  );
}
