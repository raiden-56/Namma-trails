import { Inject, Injectable, Logger, Module } from "@nestjs/common";
import { sesClient, snsClient } from "../../common/aws/clients.js";
import { ENV, type Env } from "../../config/env.js";
import { AwsMessageSender } from "./aws-message-sender.js";
import { MessageSender, type OutboundMessage } from "./message-sender.js";
import { NotificationService } from "./notification.service.js";
import { TemplateService } from "./template.service.js";

export { MessageSender, type OutboundMessage } from "./message-sender.js";
export { NotificationService } from "./notification.service.js";
export { TemplateService } from "./template.service.js";

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

/**
 * Messages (one-time codes, booking and application notices).
 *
 * MESSAGING_PROVIDER picks who delivers them:
 *   console  the server log, for development
 *   aws      Amazon SES (email) and Amazon SNS (SMS)
 * Any other value fails at start-up on purpose: the API must not run while silently
 * dropping messages.
 */
@Module({
  providers: [
    TemplateService,
    {
      provide: MessageSender,
      inject: [ENV, TemplateService],
      useFactory: (env: Env, templates: TemplateService) => {
        if (env.MESSAGING_PROVIDER === "console") return new ConsoleMessageSender(env);
        if (env.MESSAGING_PROVIDER === "aws") return new AwsMessageSender(env, templates, sesClient(env), snsClient(env));
        throw new Error(`Messaging provider "${env.MESSAGING_PROVIDER}" is not implemented yet`);
      },
    },
    NotificationService,
  ],
  exports: [MessageSender, NotificationService, TemplateService],
})
export class MessagingModule {}
