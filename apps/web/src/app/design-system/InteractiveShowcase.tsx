"use client";

import { useState } from "react";
import { destinations } from "@/content/destinations";
import { Button } from "@/components/ui/Button";
import { Checkbox, Radio, Switch } from "@/components/ui/Choice";
import { DateField, DateRangeField, GuestStepper, TimeSlotPicker } from "@/components/ui/DateFields";
import { Modal, Sheet } from "@/components/ui/Dialog";
import { SearchBar } from "@/components/ui/SearchBar";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { Block } from "./Block";

/** Demo time slots — illustrative only, not availability data. */
const demoSlots = [
  { id: "a", label: "07:00", remaining: 6 },
  { id: "b", label: "09:30", remaining: 2 },
  { id: "c", label: "12:00", remaining: 0 },
  { id: "d", label: "16:30", remaining: 8 },
];

export function InteractiveShowcase() {
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [bottom, setBottom] = useState(false);
  const [on, setOn] = useState(true);
  const [date, setDate] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });
  const [slot, setSlot] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const { toast } = useToast();

  return (
    <>
      <Block id="search" title="Unified search" note="Segmented bar ≥ lg; collapses to a trigger + bottom sheet on smaller screens. Submits to /explore with query params.">
        <SearchBar destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))} />
      </Block>

      <Block id="choices" title="Choices & switch">
        <div className="flex flex-wrap gap-8">
          <div>
            <Checkbox label="Instant confirmation" description="Booking confirms without partner approval" defaultChecked />
            <Checkbox label="Disabled option" disabled />
          </div>
          <div role="radiogroup" aria-label="Ride type">
            <Radio name="ride" label="Shared ride" defaultChecked />
            <Radio name="ride" label="Private boat" />
          </div>
          <Switch checked={on} onCheckedChange={setOn} label="Listing visible" />
        </div>
      </Block>

      <Block id="dates" title="Date, time & guests" note="Our own calendar (DatePicker), not the browser's date input. Time slots and remaining seats here are demo values.">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="flex flex-col gap-4">
            <DateField label="Trip date" value={date} onChange={setDate} />
            <DateRangeField startLabel="Check-in" endLabel="Check-out" value={range} onChange={setRange} />
          </div>
          <TimeSlotPicker slots={demoSlots} value={slot} onChange={setSlot} legend="Departure (demo slots)" />
          <div className="divide-y divide-line">
            <GuestStepper label="Adults" description="13 years and above" value={adults} min={1} onChange={setAdults} />
            <GuestStepper label="Children" description="2–12 years" value={children} onChange={setChildren} />
          </div>
        </div>
      </Block>

      <Block id="tabs" title="Tabs" note="Arrow keys, Home and End move between tabs (roving tabindex).">
        <Tabs
          label="Demo tabs"
          items={[
            { id: "overview", label: "Overview", content: <p className="text-fg-muted">Overview panel.</p> },
            { id: "policies", label: "Policies", content: <p className="text-fg-muted">Cancellation and house rules panel.</p> },
            { id: "reviews", label: "Reviews", count: 0, content: <p className="text-fg-muted">Reviews panel.</p> },
          ]}
        />
        <Tabs
          label="Demo pill tabs"
          variant="pill"
          items={[
            { id: "stays", label: "Stays", content: null },
            { id: "boats", label: "Boating", content: null },
            { id: "rentals", label: "Rentals", content: null },
          ]}
        />
      </Block>

      <Block id="overlays" title="Modal, drawer, bottom sheet & toasts" note="Native <dialog> in the top layer: focus contained, Esc closes, backdrop click closes, scroll locked, focus restored.">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModal(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setBottom(true)}>
            Open bottom sheet
          </Button>
          <Button variant="ghost" onClick={() => toast({ title: "Saved", description: "Listing draft saved.", tone: "success" })}>
            Success toast
          </Button>
          <Button variant="ghost" onClick={() => toast({ title: "Payment failed", description: "No money was taken. Try again.", tone: "danger" })}>
            Error toast
          </Button>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Cancel this booking?"
          description="Demo dialog"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Keep booking
              </Button>
              <Button variant="danger" onClick={() => setModal(false)}>
                Cancel booking
              </Button>
            </>
          }
        >
          <p className="text-fg-muted">The refund amount is calculated from the service&apos;s cancellation policy before you confirm.</p>
        </Modal>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Booking details">
          <p className="text-fg-muted">Drawer content.</p>
        </Sheet>
        <Sheet open={bottom} onClose={() => setBottom(false)} title="Filters" placement="bottom">
          <p className="text-fg-muted">Bottom sheet content.</p>
        </Sheet>
      </Block>
    </>
  );
}
