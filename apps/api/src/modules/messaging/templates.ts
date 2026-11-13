/*
 * The words of every message the platform sends.
 *
 * These are the built-in defaults. A row in the notification_templates table (same
 * event, channel and locale "en", marked active) replaces the default, so the team can
 * change wording later without a release. For SMS in India the row can also carry the
 * DLT template id that the telecom operators require.
 *
 * Placeholders are written {{name}}. An unknown placeholder is left empty.
 */

export type MessageChannel = "sms" | "email";

export interface RenderedMessage {
  /** Email only. */
  subject?: string;
  text: string;
  /** SMS in India: the DLT template id registered for this exact wording. */
  externalTemplateId?: string;
}

interface TemplateText {
  sms?: string;
  email?: { subject: string; body: string };
}

export const DEFAULT_TEMPLATES: Record<string, TemplateText> = {
  otp: {
    sms: "{{code}} is your {{brand}} code. It is valid for {{minutes}} minutes. Do not share it with anyone.",
    email: {
      subject: "{{code}} is your {{brand}} code",
      body: "Your {{brand}} code is {{code}}.\n\nIt is valid for {{minutes}} minutes. Do not share it with anyone.\n\nIf you did not ask for this code, you can ignore this email.",
    },
  },
  booking_confirmed: {
    sms: "{{brand}}: booking {{reference}} for {{service}} on {{date}} is confirmed.",
    email: {
      subject: "Booking {{reference}} is confirmed",
      body: "Hello {{name}},\n\nYour booking is confirmed.\n\nBooking: {{reference}}\nService: {{service}}\nWhen: {{date}}\n\nSee it here: {{link}}\n\n{{brand}}",
    },
  },
  booking_requested: {
    email: {
      subject: "Booking request {{reference}} was sent to the partner",
      body: "Hello {{name}},\n\nYour request has gone to the partner. You pay only after the partner accepts.\n\nBooking: {{reference}}\nService: {{service}}\nWhen: {{date}}\n\nSee it here: {{link}}\n\n{{brand}}",
    },
  },
  booking_cancelled: {
    sms: "{{brand}}: booking {{reference}} for {{service}} is cancelled.",
    email: {
      subject: "Booking {{reference}} is cancelled",
      body: "Hello {{name}},\n\nBooking {{reference}} for {{service}} on {{date}} is cancelled.\n\nIf a refund is due, it is shown on the booking page: {{link}}\n\n{{brand}}",
    },
  },
  partner_new_booking: {
    email: {
      subject: "New booking {{reference}} for {{service}}",
      body: "Hello,\n\nYou have a new booking.\n\nBooking: {{reference}}\nService: {{service}}\nWhen: {{date}}\n\nOpen your partner portal to see it: {{link}}\n\n{{brand}}",
    },
  },
  provider_application_decided: {
    email: {
      subject: "Your {{brand}} partner application: {{decision}}",
      body: "Hello {{name}},\n\nYour partner application for {{business}} is now: {{decision}}.\n\nOpen your partner portal for the details: {{link}}\n\n{{brand}}",
    },
  },
};

export function fillPlaceholders(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => variables[name] ?? "");
}

/** Renders a built-in template. Returns null when the event has no wording for that channel. */
export function renderDefault(event: string, channel: MessageChannel, variables: Record<string, string>): RenderedMessage | null {
  const template = DEFAULT_TEMPLATES[event];
  if (!template) return null;
  if (channel === "sms") return template.sms ? { text: fillPlaceholders(template.sms, variables) } : null;
  return template.email ? { subject: fillPlaceholders(template.email.subject, variables), text: fillPlaceholders(template.email.body, variables) } : null;
}
