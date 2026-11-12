import { ArrowUpRight, Search } from "lucide-react";
import { destinations } from "@/content/destinations";
import { MapView } from "@/components/map/MapView";
import { Badge, StatusChip, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DestinationCard, ServiceCard } from "@/components/ui/Cards";
import { Avatar, KpiTile, Stepper } from "@/components/ui/Display";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Breadcrumbs, Pagination } from "@/components/ui/Navigation";
import { PendingAction } from "@/components/ui/PendingAction";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";
import { DocumentChecklist } from "@/features/partner-onboarding/steps";
import type { BookingStatus, DocumentStatus, ListingStatus, ProviderStatus } from "@/lib/catalog";
import { Block } from "./Block";

const providerStatuses: ProviderStatus[] = ["draft", "submitted", "under_review", "info_requested", "approved", "rejected", "suspended", "expired"];
const listingStatuses: ListingStatus[] = ["draft", "pending_review", "changes_requested", "approved", "published", "paused", "rejected", "archived"];
const bookingStatuses: BookingStatus[] = [
  "draft",
  "pending_availability",
  "awaiting_provider_confirmation",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancellation_requested",
  "cancelled",
  "refund_pending",
  "partially_refunded",
  "refunded",
  "failed",
  "disputed",
];
const documentStatuses: DocumentStatus[] = ["pending", "verified", "rejected", "expired", "superseded"];
const tones: Tone[] = ["neutral", "accent", "success", "warning", "danger", "info"];

/** Demo rows for the table component only. */
const demoRows = [
  { id: "1", business: "Demo Boat Co.", status: "under_review" as ProviderStatus, submitted: "Demo date" },
  { id: "2", business: "Demo Homestay", status: "info_requested" as ProviderStatus, submitted: "Demo date" },
];

export function StaticShowcase() {
  const first = destinations[0]!;
  return (
    <>
      <Block id="buttons" title="Buttons" note="Primary uses an ink label on tomato (5.0:1); hover moves to burnt + ivory (5.1:1). Unwired actions use PendingAction — visibly disabled with a reason.">
        {(["primary", "strong", "secondary", "ghost", "danger", "link"] as const).map((v) => (
          <div key={v} className="flex flex-wrap items-center gap-3">
            <code className="w-24 text-xs text-fg-muted">{v}</code>
            <Button variant={v} size="sm">
              Small
            </Button>
            <Button variant={v}>Medium</Button>
            <Button variant={v} size="lg" trailingIcon={<ArrowUpRight className="size-4" />}>
              Large
            </Button>
            <Button variant={v} disabled>
              Disabled
            </Button>
            <Button variant={v} loading>
              Loading
            </Button>
          </div>
        ))}
        <PendingAction>Export report</PendingAction>
      </Block>

      <Block id="inputs" title="Form controls" note="Field wires label, hint and error to the control with aria-describedby / aria-invalid.">
        <div className="grid gap-5 md:grid-cols-3">
          <Field id="ds-name" label="Business name" hint="As shown to travellers" required>
            <Input placeholder="Your business" />
          </Field>
          <Field id="ds-email" label="Email" error="Enter a valid email.">
            <Input defaultValue="not-an-email" />
          </Field>
          <Field id="ds-disabled" label="Disabled">
            <Input disabled defaultValue="Read only" />
          </Field>
          <Field id="ds-select" label="Business type">
            <Select
              defaultValue=""
              placeholder="Choose…"
              options={[
                { value: "boat_operator", label: "Boat operator" },
                { value: "homestay", label: "Homestay or cottage" },
                { value: "tour_guide", label: "Tour guide" },
              ]}
            />
          </Field>
          <Field id="ds-textarea" label="Description" className="md:col-span-2">
            <Textarea placeholder="Describe your business" />
          </Field>
        </div>
      </Block>

      <Block id="status" title="Badges & status chips" note="One mapping for provider, listing, booking and document statuses across all four experiences.">
        <div className="flex flex-wrap gap-2">
          {tones.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
        </div>
        {(
          [
            ["Provider", providerStatuses.map((s) => <StatusChip key={s} kind="provider" status={s} />)],
            ["Listing", listingStatuses.map((s) => <StatusChip key={s} kind="listing" status={s} />)],
            ["Booking", bookingStatuses.map((s) => <StatusChip key={s} kind="booking" status={s} />)],
            ["Document", documentStatuses.map((s) => <StatusChip key={s} kind="document" status={s} />)],
          ] as const
        ).map(([label, chips]) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-fg-muted">{label}</span>
            <div className="flex flex-wrap gap-2">{chips}</div>
          </div>
        ))}
      </Block>

      <Block id="cards" title="Cards" note="Whole-card link with hover zoom and arrow nudge; focus ring on keyboard. ServiceCard values below are demo values for the component only.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <DestinationCard href={`/destinations/${first.slug}`} name={first.name} district={first.district} summary={first.summary} image={null} scene={first.scene} status={first.status} />
          <ServiceCard
            href="/design-system#cards"
            title="Demo listing title"
            providerName="Demo partner"
            providerVerified
            locationLabel="Demo town"
            categoryLabel="Boating"
            coverImageUrl={null}
            scene="backwater"
            fromPricePaise={150000}
            priceUnitLabel="person"
            ratingAverage={4.6}
            ratingCount={12}
          />
          <ServiceCard
            href="/design-system#cards"
            title="Demo listing without price or reviews"
            providerName="Demo partner"
            providerVerified={false}
            locationLabel="Demo town"
            categoryLabel="Stays"
            coverImageUrl={null}
            fromPricePaise={null}
            priceUnitLabel={null}
            ratingAverage={null}
            ratingCount={0}
          />
          <KpiTile label="Gross booking value" value={null} />
        </div>
      </Block>

      <Block id="tables" title="Tables" note="Real table ≥ md; stacked labelled cards on phones. Rows are demo values.">
        <Table
          caption="Demo provider applications"
          rows={demoRows}
          getRowKey={(r) => r.id}
          columns={[
            { key: "business", header: "Business", cell: (r) => r.business },
            { key: "status", header: "Status", cell: (r) => <StatusChip kind="provider" status={r.status} /> },
            { key: "submitted", header: "Submitted", cell: (r) => r.submitted, align: "right" },
          ]}
        />
      </Block>

      <Block id="feedback" title="Loading, empty & error states">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/2] rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
              <Spinner /> Loading…
            </span>
          </div>
          <EmptyState title="No bookings yet" description="Bookings appear here once your listings are published." />
          <ErrorState description="We could not reach the server." action={<Button variant="secondary" size="sm">Try again</Button>} />
        </div>
      </Block>

      <Block id="navigation" title="Navigation, avatar, stepper">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Destinations", href: "/destinations" }, { label: "Gokarna" }]} />
        <Pagination page={3} pageCount={8} hrefFor={(p) => `/design-system?page=${p}#navigation`} />
        <div className="flex items-center gap-3">
          <Avatar name="Demo Person" size="sm" />
          <Avatar name="Demo Person" />
          <Avatar name="Demo Person" size="lg" />
        </div>
        <Stepper
          current={2}
          steps={["Account", "Verify", "Business", "Services", "Location", "Documents", "Submit"].map((l) => ({ id: l, label: l }))}
        />
      </Block>

      <Block id="onboarding" title="Onboarding document checklist" note="Category-specific requirements shown during registration (display defaults; the API serves the jurisdiction-aware list).">
        <DocumentChecklist categories={["boating", "two_wheeler_rental"]} />
      </Block>

      <Block id="map" title="Map abstraction" note="Provider-agnostic; shows an accessible list until a map provider is configured. No invented distances or routes.">
        <MapView title="Places in Gokarna" markers={first.attractions.map((a) => ({ id: a.name, label: a.name }))} />
      </Block>

      <Block id="icons" title="Iconography">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Search className="size-5 text-fg" aria-hidden="true" /> Lucide icons at 16/20/24px, 1.5–2px stroke, always paired with text or an accessible label.
        </p>
      </Block>
    </>
  );
}
