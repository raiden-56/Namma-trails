export interface OutboundMessage {
  channel: "sms" | "email";
  to: string;
  /** Notification template event key (e.g. "otp", "booking_confirmed"). */
  template: string;
  variables: Record<string, string>;
}

/**
 * Provider-agnostic message sender. The rest of the API only knows this class, so the
 * real provider can change (console in development, AWS on the server) without
 * touching the code that sends.
 */
export abstract class MessageSender {
  abstract send(message: OutboundMessage): Promise<void>;
}
