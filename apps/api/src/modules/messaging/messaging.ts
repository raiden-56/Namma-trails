import { Inject, Injectable, Logger, Module } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";

export interface OutboundMessage {
  channel: "sms" | "email";
  to: string;
  /** Notification template event key (e.g. "otp", "provider_application_submitted"). */
  template: string;
  variables: Record<string, string>;
}

/** Provider-agnostic message sender. Real providers (MSG91/Twilio SMS with DLT templates, SES email) plug in here. */
export abstract class MessageSender {
  abstract send(message: OutboundMessage): Promise<void>;
}

/**
 * Development-only sender: writes messages to the server log so OTPs can be
 * used locally. Env validation forbids it in staging/production.
 */
@Injectable()
export class ConsoleMessageSender extends MessageSender {
  private readonly logger = new Logger("Messaging");
  /** Last messages sent, newest last. Read by the dev-only outbox endpoint (E2E tests, local QA). */
  readonly outbox: (OutboundMessage & { sentAt: string })[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async send(message: OutboundMessage): Promise<void> {
    if (this.env.NODE_ENV === "production" || this.env.NODE_ENV === "staging") {
      throw new Error("ConsoleMessageSender must not be used outside development");
    }
    this.outbox.push({ ...message, sentAt: new Date().toISOString() });
    if (this.outbox.length > 200) this.outbox.shift();
    this.logger.warn(`[DEV ONLY] ${message.channel} → ${message.to} [${message.template}] ${JSON.stringify(message.variables)}`);
  }
}

/** True only for local development/test with the console sender: the outbox route is never registered elsewhere. */
export function devOutboxEnabled(env: Env): boolean {
  return env.MESSAGING_PROVIDER === "console" && (env.NODE_ENV === "development" || env.NODE_ENV === "test");
}

@Module({
  providers: [
    {
      provide: MessageSender,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.MESSAGING_PROVIDER === "console") return new ConsoleMessageSender(env);
        // Real providers are added in Phase 7 (notifications). Failing closed is deliberate.
        throw new Error(`Messaging provider "${env.MESSAGING_PROVIDER}" is not implemented yet`);
      },
    },
  ],
  exports: [MessageSender],
})
export class MessagingModule {}
