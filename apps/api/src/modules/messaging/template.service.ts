import { Inject, Injectable, Logger } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { fillPlaceholders, renderDefault, type MessageChannel, type RenderedMessage } from "./templates.js";

interface StoredTemplate {
  subject: string | null;
  body: string;
  externalTemplateId: string | null;
}

const CACHE_MS = 60_000;

/**
 * Turns an event ("otp", "booking_confirmed") into the final words of a message.
 * A row in notification_templates wins; otherwise the built-in wording is used.
 * If the database cannot be reached, the built-in wording is used, so a one-time code
 * can still be sent.
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger("Templates");
  private readonly cache = new Map<string, { at: number; value: StoredTemplate | null }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async render(event: string, channel: MessageChannel, variables: Record<string, string>): Promise<RenderedMessage> {
    const values = { brand: this.env.BRAND_NAME, ...variables };
    const stored = await this.stored(event, channel);
    if (stored) {
      return {
        ...(stored.subject ? { subject: fillPlaceholders(stored.subject, values) } : {}),
        text: fillPlaceholders(stored.body, values),
        ...(stored.externalTemplateId ? { externalTemplateId: stored.externalTemplateId } : {}),
      };
    }
    const builtIn = renderDefault(event, channel, values);
    if (!builtIn) throw new Error(`No ${channel} wording exists for the "${event}" message`);
    return builtIn;
  }

  private async stored(event: string, channel: MessageChannel): Promise<StoredTemplate | null> {
    const key = `${event}:${channel}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    let value: StoredTemplate | null = null;
    try {
      value = await this.prisma.notificationTemplate.findFirst({
        where: { event, channel, locale: "en", isActive: true },
        select: { subject: true, body: true, externalTemplateId: true },
      });
    } catch (error) {
      this.logger.warn(`Could not read the "${event}" template from the database; using the built-in wording. ${String(error)}`);
    }
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }
}
