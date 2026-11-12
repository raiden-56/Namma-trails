"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Circle, Clock, FileWarning } from "lucide-react";
import { endpoints, type AdminProviderDetail, type ProviderDecision } from "@/lib/api/endpoints";
import { adminOps } from "@/lib/api/marketplace";
import { ReasonDialog } from "@/features/partner/ReasonDialog";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const DECISIONS: Record<ProviderDecision, { label: string; variant: "primary" | "secondary" | "danger"; needsMessage: boolean; help: string }> = {
  start_review: { label: "Start review", variant: "primary", needsMessage: false, help: "Moves the application to Under review." },
  approve: { label: "Approve", variant: "primary", needsMessage: false, help: "Makes the partner eligible to publish listings." },
  request_info: { label: "Request information", variant: "secondary", needsMessage: true, help: "The partner sees your message and can resubmit." },
  reject: { label: "Reject", variant: "danger", needsMessage: true, help: "The partner sees your reason and may reapply." },
  suspend: { label: "Suspend", variant: "danger", needsMessage: true, help: "Hides all of the partner's listings immediately." },
  reinstate: { label: "Reinstate", variant: "primary", needsMessage: false, help: "Restores an approved, suspended partner." },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? "—"}</dd>
    </div>
  );
}

function DecisionPanel({ p }: { p: AdminProviderDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [decision, setDecision] = useState<ProviderDecision | null>(p.allowedDecisions[0] ?? null);
  const allowedKey = p.allowedDecisions.join(",");
  // After a decision the status (and so the allowed decisions) change: start from the first new option.
  useEffect(() => {
    setDecision(p.allowedDecisions[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the allowed set changes
  }, [allowedKey]);
  const [message, setMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const decide = useMutation({
    mutationFn: () =>
      endpoints.adminDecide(p.id, { decision: decision!, ...(message.trim() ? { message: message.trim() } : {}), ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}) }),
    onSuccess: async (res) => {
      toast({ title: `${p.displayName} is now ${res.data.status.replace(/_/g, " ")}`, tone: "success" });
      setMessage("");
      setInternalNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  if (p.allowedDecisions.length === 0) {
    return (
      <Section title="Decision">
        <p className="text-sm text-fg-muted" data-testid="no-decision-reason">
          {p.status === "draft"
            ? "Waiting for the partner. A draft can only be reviewed after the partner uploads their documents and submits."
            : p.status === "submitted"
              ? "Submitted applications are picked up with Start review."
              : "No decisions are available in this status."}
        </p>
      </Section>
    );
  }

  const meta = decision ? DECISIONS[decision] : null;
  const approveBlocked = decision === "approve" && !p.requirements.fullyVerified;
  const messageMissing = Boolean(meta?.needsMessage) && message.trim().length < 10;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!decision || approveBlocked || messageMissing) return;
    decide.mutate();
  }

  return (
    <Section title="Decision">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Decision">
          {p.allowedDecisions.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={decision === d}
              onClick={() => setDecision(d)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${decision === d ? "border-fg bg-fg text-surface" : "border-line-strong text-fg-muted hover:text-fg"}`}
            >
              {DECISIONS[d].label}
            </button>
          ))}
        </div>
        {meta ? <p className="text-xs text-fg-muted">{meta.help}</p> : null}
        <Field id="decision-message" label={meta?.needsMessage ? "Message to the partner (required)" : "Message to the partner (optional)"} hint="The partner sees this.">
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Field id="decision-note" label="Internal note (optional)" hint="Only admins see this.">
          <Textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
        </Field>
        {approveBlocked ? (
          <p role="alert" className="rounded-md bg-warning/10 p-3 text-sm">
            Approval is blocked: every required document must be uploaded and verified first.
          </p>
        ) : null}
        {decide.isError ? (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {decide.error.message}
          </p>
        ) : null}
        <Button type="submit" variant={meta?.variant ?? "primary"} loading={decide.isPending} disabled={!decision || approveBlocked || messageMissing}>
          {meta ? `${meta.label}` : "Choose a decision"}
        </Button>
      </form>
    </Section>
  );
}

/**
 * One uploaded document with verify / reject actions while it awaits review.
 * (The secure file viewer arrives with document upload; demo documents have no file to open.)
 */
function DocumentRow({ doc, providerId }: { doc: AdminProviderDetail["documents"][number]; providerId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const decide = useMutation({
    mutationFn: (v: { decision: "verify" | "reject"; reason?: string }) => adminOps.decideDocument(doc.id, v.decision, v.reason),
    onSuccess: async (res) => {
      toast({ title: `${doc.label}: ${res.data.status}`, tone: res.data.status === "verified" ? "success" : "info" });
      setRejecting(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "application", providerId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
    },
  });
  return (
    <li className="flex flex-col gap-1 border-b border-line pb-2 last:border-0 last:pb-0" data-testid="document-row">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-fg-muted" aria-hidden="true" />
        <span>
          {doc.label} {doc.number ? <span className="text-fg-muted">({doc.number})</span> : null}
          {doc.expiresOn ? <span className="text-xs text-fg-muted"> · expires {doc.expiresOn}</span> : null}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {doc.status === "pending" ? (
            <>
              <Button size="sm" variant="primary" loading={decide.isPending && decide.variables?.decision === "verify"} disabled={decide.isPending} onClick={() => decide.mutate({ decision: "verify" })}>
                Verify
              </Button>
              <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => setRejecting(true)}>
                Reject
              </Button>
            </>
          ) : null}
          <StatusChip kind="document" status={doc.status as "pending"} />
        </span>
      </div>
      {doc.rejectionReason ? <p className="pl-6 text-xs text-danger">{doc.rejectionReason}</p> : null}
      {decide.isError && !rejecting ? (
        <p role="alert" className="pl-6 text-xs text-danger">
          {decide.error.message}
        </p>
      ) : null}
      <ReasonDialog
        open={rejecting}
        title={`Reject: ${doc.label}`}
        description="The partner sees the reason and uploads a replacement."
        confirmLabel="Reject document"
        variant="danger"
        minLength={5}
        reasonLabel="Reason for the partner"
        busy={decide.isPending}
        error={decide.isError ? decide.error.message : null}
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => decide.mutate({ decision: "reject", reason })}
      />
    </li>
  );
}

export function ProviderReview({ providerId }: { providerId: string }) {
  const q = useQuery({ queryKey: ["admin", "application", providerId], queryFn: () => endpoints.adminApplication(providerId) });

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState title="Couldn't load this application" description={q.error.message} />;
  const p = q.data.data;
  const required = [...p.requirements.missing.map((r) => ({ ...r, state: "missing" as const })), ...p.requirements.rejected.map((r) => ({ ...r, state: "rejected" as const })), ...p.requirements.expired.map((r) => ({ ...r, state: "expired" as const })), ...p.requirements.pendingReview.map((r) => ({ ...r, state: "pending" as const }))];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/providers" className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> All applications
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.displayName}</h1>
          <p className="text-sm text-fg-muted">
            {p.businessType.replace(/_/g, " ")} · {p.address.city}, {p.address.district}
            {p.isDemo ? " · demo data" : ""}
          </p>
        </div>
        <StatusChip kind="provider" status={p.status} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <Section title="Business">
            <dl className="flex flex-col gap-2">
              <Row label="Legal name">{p.legalName}</Row>
              <Row label="Description">{p.description}</Row>
              <Row label="Registration no.">{p.registrationNumber}</Row>
              <Row label="GSTIN">{p.gstin}</Row>
              <Row label="Address">{[p.address.line1, p.address.line2, p.address.city, p.address.district, p.address.state, p.address.pincode].filter(Boolean).join(", ")}</Row>
              <Row label="Contact">
                {p.contact.phone} · {p.contact.email}
              </Row>
              <Row label="Owner">{p.owner ? [p.owner.name, p.owner.phone, p.owner.email].filter(Boolean).join(" · ") : null}</Row>
              <Row label="Started">{fmt(p.createdAt)}</Row>
              <Row label="Submitted">{p.submittedAt ? fmt(p.submittedAt) : "Not yet submitted"}</Row>
            </dl>
          </Section>

          <Section title="Services and operating destinations">
            <div className="flex flex-wrap gap-1.5">
              {p.categories.map((c) => (
                <Badge key={c.key} tone={c.status === "approved" ? "success" : "neutral"}>
                  {c.name} · {c.status}
                </Badge>
              ))}
            </div>
            <p className="text-sm">{p.destinations.map((d) => d.name).join(", ") || "No destination chosen"}</p>
          </Section>

          <Section
            title="Documents"
            aside={p.requirements.fullyVerified ? <Badge tone="success">All verified</Badge> : <Badge tone="warning">{required.length} outstanding</Badge>}
          >
            {p.documents.length === 0 ? <p className="text-sm text-fg-muted">No documents uploaded yet.</p> : null}
            <ul className="flex flex-col gap-2 text-sm">
              {p.documents.map((d) => (
                <DocumentRow key={d.id} doc={d} providerId={p.id} />
              ))}
              {required
                .filter((r) => r.state === "missing")
                .map((r) => (
                  <li key={r.type} className="flex items-center gap-2 text-fg-muted">
                    <Circle className="size-4" aria-hidden="true" /> {r.label}
                    <span className="ml-auto text-xs">Not uploaded</span>
                  </li>
                ))}
              {required
                .filter((r) => r.state === "rejected" || r.state === "expired")
                .map((r) => (
                  <li key={r.type} className="flex items-center gap-2 text-danger">
                    {r.state === "expired" ? <Clock className="size-4" aria-hidden="true" /> : <FileWarning className="size-4" aria-hidden="true" />} {r.label}
                    <span className="ml-auto text-xs">{r.state === "expired" ? "Expired" : "Needs replacing"}</span>
                  </li>
                ))}
            </ul>
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <DecisionPanel p={p} />
          <Section title="History">
            <ol className="flex flex-col gap-3 border-l border-line pl-3">
              {p.history.map((h, i) => (
                <li key={`${h.createdAt}-${i}`} className="text-sm">
                  <p className="font-medium">{h.event.replace(/_/g, " ")}</p>
                  <p className="text-xs text-fg-muted">
                    {fmt(h.createdAt)}
                    {h.actor ? ` · ${h.actor}` : ""}
                  </p>
                  {h.message ? <p className="mt-1 rounded-md bg-surface-sunken p-2">{h.message}</p> : null}
                  {h.internalNote ? (
                    <p className="mt-1 rounded-md border border-dashed border-line-strong p-2 text-xs">
                      <span className="font-semibold">Internal: </span>
                      {h.internalNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
