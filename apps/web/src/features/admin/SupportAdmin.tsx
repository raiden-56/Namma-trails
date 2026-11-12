"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { adminOps, type AdminTicketRow } from "@/lib/api/marketplace";
import { cn } from "@/lib/cn";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { ADMIN_DENIED, QueryState, fmtDateTime } from "@/features/partner/shared";

const STATUS_TABS: { key: string; label: string; status?: AdminTicketRow["status"] }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open", status: "open" },
  { key: "escalated", label: "Escalated", status: "escalated" },
  { key: "pending_customer", label: "Waiting on customer", status: "pending_customer" },
  { key: "resolved", label: "Resolved", status: "resolved" },
];

const PRIORITY_TONE = { urgent: "danger", high: "warning", normal: "neutral", low: "neutral" } as const;
const STATUS_TONE: Record<AdminTicketRow["status"], "info" | "danger" | "warning" | "success" | "neutral"> = {
  open: "info",
  escalated: "danger",
  pending_customer: "warning",
  pending_provider: "warning",
  resolved: "success",
  closed: "neutral",
};
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const label = (s: string) => s.replace(/_/g, " ");

export function SupportAdmin() {
  const params = useSearchParams();
  const pathname = usePathname();
  const tab = STATUS_TABS.find((t) => t.key === params.get("status")) ?? STATUS_TABS[0]!;
  const q = useQuery({ queryKey: ["admin", "tickets", tab.key], queryFn: () => adminOps.tickets(tab.status ? { status: tab.status } : {}), retry: false });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="text-sm text-fg-muted">Traveller and partner tickets, including safety incidents. Urgent tickets are listed first.</p>
      </div>
      <nav aria-label="Ticket status" className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? pathname : `${pathname}?status=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", t.key === tab.key ? "border-fg bg-fg text-surface" : "border-line-strong text-fg-muted hover:text-fg")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <QueryState isPending={q.isPending} error={q.error} what="support tickets" deniedHint={ADMIN_DENIED}>
        {() => (
          <Table<AdminTicketRow>
            caption="Support tickets"
            density="compact"
            rows={[...q.data!.data].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])}
            getRowKey={(t) => t.reference}
            columns={[
              {
                key: "subject",
                header: "Ticket",
                cell: (t) => (
                  <span className="flex flex-col">
                    <Link href={`/admin/support/${t.reference}`} className="font-semibold underline-offset-4 hover:underline">
                      {t.subject}
                    </Link>
                    <span className="text-xs text-fg-muted">
                      {t.reference} · {label(t.category)}
                    </span>
                  </span>
                ),
              },
              { key: "priority", header: "Priority", cell: (t) => <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge> },
              { key: "status", header: "Status", cell: (t) => <Badge tone={STATUS_TONE[t.status]} dot>{label(t.status)}</Badge> },
              { key: "requester", header: "From", cell: (t) => t.requester },
              { key: "booking", header: "Booking", cell: (t) => t.bookingReference ?? "—" },
              { key: "assignee", header: "Assignee", cell: (t) => t.assignee ?? <span className="text-fg-muted">Unassigned</span> },
              { key: "created", header: "Opened", align: "right", cell: (t) => fmtDateTime(t.createdAt) },
            ]}
            empty={<EmptyState title="No tickets here" />}
          />
        )}
      </QueryState>
    </div>
  );
}

export function TicketDetail({ reference }: { reference: string }) {
  const q = useQuery({ queryKey: ["admin", "ticket", reference], queryFn: () => adminOps.ticket(reference), retry: false });
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/support" className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> All tickets
      </Link>
      <QueryState isPending={q.isPending} error={q.error} what="this ticket" deniedHint={ADMIN_DENIED}>
        {() => {
          const t = q.data!.data;
          return (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">{t.subject}</h1>
                  <p className="text-sm text-fg-muted">
                    {t.reference} · {label(t.category)} · opened {fmtDateTime(t.createdAt)}
                  </p>
                </div>
                <span className="flex gap-1.5">
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  <Badge tone={STATUS_TONE[t.status]} dot>
                    {label(t.status)}
                  </Badge>
                </span>
              </div>
              <div className="grid gap-5 xl:grid-cols-3">
                <section aria-label="Conversation" className="flex flex-col gap-3 xl:col-span-2">
                  {t.messages.map((m, i) => (
                    <article
                      key={`${m.createdAt}-${i}`}
                      className={cn("rounded-lg border p-3 text-sm", m.internal ? "border-dashed border-warning/60 bg-warning/5" : "border-line bg-surface-raised")}
                    >
                      <header className="mb-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                        <span className="font-semibold text-fg">{m.author}</span>
                        <span>{fmtDateTime(m.createdAt)}</span>
                        {m.internal ? (
                          <Badge tone="warning">
                            <Lock className="size-3" aria-hidden="true" /> Internal
                          </Badge>
                        ) : null}
                      </header>
                      <p className="whitespace-pre-line">{m.body}</p>
                    </article>
                  ))}
                  <p className="text-xs text-fg-muted">Replying and changing ticket status arrive with the support workflow in Phase 7.</p>
                </section>
                <aside className="flex flex-col gap-3">
                  <section className="rounded-lg border border-line bg-surface-raised p-4 text-sm">
                    <h2 className="mb-2 font-semibold">Requester</h2>
                    <p>{t.requester.name ?? "—"}</p>
                    <p className="text-fg-muted">{t.requester.phone ?? ""}</p>
                    <p className="text-fg-muted">{t.requester.email ?? ""}</p>
                  </section>
                  {t.booking ? (
                    <section className="rounded-lg border border-line bg-surface-raised p-4 text-sm">
                      <h2 className="mb-2 font-semibold">Linked booking</h2>
                      <p className="flex items-center justify-between gap-2">
                        <Link href={`/admin/bookings?q=${t.booking.reference}`} className="underline underline-offset-4">
                          {t.booking.reference}
                        </Link>
                        <StatusChip kind="booking" status={t.booking.status} />
                      </p>
                      {t.provider ? <p className="mt-1 text-fg-muted">{t.provider}</p> : null}
                    </section>
                  ) : null}
                  {t.incident ? (
                    <section className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm">
                      <h2 className="mb-2 font-semibold">Safety incident</h2>
                      <dl className="grid grid-cols-[7rem_1fr] gap-1">
                        {Object.entries(t.incident).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-fg-muted">{k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase()}</dt>
                            <dd>{/At$/.test(k) && typeof v === "string" && !Number.isNaN(Date.parse(v)) ? fmtDateTime(v) : String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}
                </aside>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
