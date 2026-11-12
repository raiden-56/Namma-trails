"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock, FileWarning, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { endpoints, type Me, type ProviderApplication } from "@/lib/api/endpoints";
import { partner } from "@/lib/api/marketplace";
import { formatInrFromPaise } from "@/lib/format";
import type { ProviderStatus } from "@/lib/catalog";
import { StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KpiTile } from "@/components/ui/Display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useMe } from "@/features/auth/session";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const EVENT_LABEL: Record<string, string> = {
  application_created: "Application started",
  application_submitted: "Submitted for verification",
  application_resubmitted: "Resubmitted with changes",
  review_started: "Verification team started reviewing",
  info_requested: "More information requested",
  application_approved: "Approved",
  application_rejected: "Not approved",
  application_reopened: "Application reopened",
  provider_suspended: "Account suspended",
  provider_reinstated: "Account reinstated",
  required_document_expired: "A required document expired",
  documents_renewed: "Documents renewed",
};

/** What the partner should do next, for each verification status. */
function nextStep(app: ProviderApplication): { tone: "info" | "warning" | "success" | "danger"; title: string; body: ReactNode } {
  const latestMessage = [...app.history].reverse().find((h) => h.message)?.message;
  const missing = app.requirements.missing.length;
  const byStatus: Record<ProviderStatus, ReturnType<typeof nextStep>> = {
    draft: {
      tone: "warning",
      title: "Finish your application",
      body: (
        <>
          Upload the {missing} required document{missing === 1 ? "" : "s"} listed below, then submit for verification. Document upload opens in
          the next release of the partner portal; until then your application stays saved as a draft.
        </>
      ),
    },
    submitted: { tone: "info", title: "Submitted — waiting for review", body: "Our verification team reviews applications in the order they arrive." },
    under_review: { tone: "info", title: "Under review", body: "The verification team is checking your documents. We'll tell you if anything else is needed." },
    info_requested: { tone: "warning", title: "More information needed", body: latestMessage ?? "Check the message from the verification team below." },
    approved: { tone: "success", title: "You are a verified partner", body: "Your business is verified and your published listings are open for bookings. Keep your documents up to date to stay bookable." },
    rejected: { tone: "danger", title: "Application not approved", body: latestMessage ?? "See the reason below. You can correct your details and reapply." },
    suspended: { tone: "danger", title: "Account suspended", body: latestMessage ?? "Your listings are hidden. Contact partner support." },
    expired: { tone: "warning", title: "A document has expired", body: "Upload a renewed document to keep your listings bookable." },
  };
  return byStatus[app.status];
}

const toneClass = {
  info: "border-info/40 bg-info/5",
  warning: "border-warning/50 bg-warning/10",
  success: "border-success/40 bg-success/5",
  danger: "border-danger/40 bg-danger/5",
} as const;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function PartnerDashboard() {
  const me = useMe();
  const membership = me.data?.providers[0];
  const app = useQuery({
    queryKey: ["partner", "application", membership?.id],
    queryFn: () => endpoints.getProviderApplication(membership!.id),
    enabled: Boolean(membership),
  });
  const stats = useQuery({
    queryKey: ["partner", "dashboard", membership?.id],
    queryFn: () => partner.dashboard(membership!.id),
    enabled: Boolean(membership),
    retry: false,
  });

  if (!membership) return null; // SessionGate handles users without a partner organisation
  if (app.isPending) return <Skeleton className="h-96" />;
  if (app.isError) return <ErrorState title="Couldn't load your partner account" description={app.error.message} />;

  const a = app.data.data;
  const step = nextStep(a);
  const required = [...a.requirements.missing, ...a.requirements.rejected, ...a.requirements.expired];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted">{a.legalName !== a.displayName ? a.legalName : a.businessType.replace(/_/g, " ")}</p>
          <h1 className="font-display text-display-sm">{a.displayName}</h1>
        </div>
        <StatusChip kind="provider" status={a.status} />
      </div>

      <div role="status" className={`flex flex-col gap-1 rounded-xl border p-5 ${toneClass[step.tone]}`} data-testid="partner-next-step">
        <p className="font-semibold">{step.title}</p>
        <p className="text-sm text-fg-muted">{step.body}</p>
      </div>

      {stats.data && stats.data.data.pendingRequests > 0 ? (
        <Link
          href="/partner/bookings?view=requests"
          className="flex items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 font-semibold hover:bg-warning/15"
          data-testid="requests-callout"
        >
          <span>
            {stats.data.data.pendingRequests} booking request{stats.data.data.pendingRequests === 1 ? "" : "s"} waiting for your answer
          </span>
          <span aria-hidden="true">Review →</span>
        </Link>
      ) : null}

      <section aria-label="Business performance" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {stats.data ? (
          <>
            <KpiTile label="Bookings today" value={stats.data.data.bookingsToday} />
            <KpiTile label="Upcoming bookings" value={stats.data.data.upcomingBookings} />
            <KpiTile label="Requests waiting" value={stats.data.data.pendingRequests} />
            <KpiTile label="Earnings this month" value={formatInrFromPaise(stats.data.data.earningsThisMonthPaise)} hint="After commission and refunds" />
            <KpiTile label="Listing views" value={stats.data.data.listingViews.toLocaleString("en-IN")} />
            <KpiTile
              label="Rating"
              value={stats.data.data.rating.average !== null ? `★ ${stats.data.data.rating.average.toFixed(1)}` : "—"}
              hint={`${stats.data.data.rating.count} review${stats.data.data.rating.count === 1 ? "" : "s"}`}
            />
          </>
        ) : (
          ["Bookings today", "Upcoming bookings", "Requests waiting", "Earnings this month", "Listing views", "Rating"].map((label) => (
            <KpiTile key={label} label={label} value={null} hint={stats.isError ? "Not available for your role" : "Loading…"} />
          ))
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Documents required for verification">
          {required.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> All required documents are uploaded.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {a.requirements.missing.map((d) => (
                <li key={d.type} className="flex items-center gap-2">
                  <Circle className="size-4 text-fg-muted" aria-hidden="true" /> {d.label}
                  <span className="ml-auto text-xs text-fg-muted">Not uploaded</span>
                </li>
              ))}
              {a.requirements.rejected.map((d) => (
                <li key={d.type} className="flex items-center gap-2 text-danger">
                  <FileWarning className="size-4" aria-hidden="true" /> {d.label}
                  <span className="ml-auto text-xs">Needs replacing</span>
                </li>
              ))}
              {a.requirements.expired.map((d) => (
                <li key={d.type} className="flex items-center gap-2 text-warning">
                  <Clock className="size-4" aria-hidden="true" /> {d.label}
                  <span className="ml-auto text-xs">Expired</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fg-muted">Documents are private: only our verification team can view them. Requirements can vary by district.</p>
        </Panel>

        <Panel title="Services and locations">
          <ul className="flex flex-col gap-2 text-sm">
            {a.categories.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2">
                <span>{c.name}</span>
                <span className="text-xs text-fg-muted">{c.status === "approved" ? "Approved" : "Awaiting verification"}</span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <MapPin className="size-4 text-fg-muted" aria-hidden="true" />
            {a.destinations.map((d) => d.name).join(", ") || "No operating destination chosen"}
          </p>
        </Panel>
      </div>

      <Panel title="Application history">
        {a.history.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ol className="flex flex-col gap-3 border-l border-line pl-4">
            {[...a.history].reverse().map((h, i) => (
              <li key={`${h.createdAt}-${i}`} className="text-sm">
                <p className="font-medium">{EVENT_LABEL[h.event] ?? h.event.replace(/_/g, " ")}</p>
                <p className="text-xs text-fg-muted">{fmt(h.createdAt)}</p>
                {h.message ? <p className="mt-1 rounded-md bg-surface-sunken p-2">{h.message}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

export function partnerAllowed(me: Me) {
  return me.providers.length > 0;
}

export function PartnerNoOrganisation() {
  return (
    <EmptyState
      title="You haven't registered a business yet"
      description="Register your homestay, boat rides, rentals or other services to start receiving bookings."
      action={<Button href="/partner/register">Register your business</Button>}
    />
  );
}
