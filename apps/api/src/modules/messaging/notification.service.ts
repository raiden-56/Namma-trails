import { Inject, Injectable, Logger } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { MessageSender } from "./message-sender.js";

export interface NotifyInput {
  /** Template key, for example "booking_confirmed". */
  event: string;
  channel: "sms" | "email";
  recipient: string;
  userId?: string | null;
  variables: Record<string, string>;
  /** The same key is only ever sent once (safe to call again after a retry). */
  dedupeKey?: string;
}

export type BookingEvent = "booking_confirmed" | "booking_requested" | "booking_cancelled";

const IST_DATE = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Sends the platform's messages about things that happened (a booking was confirmed,
 * an application was decided) and keeps a record of each one in the notifications table:
 * who it went to, when, and whether the provider accepted it.
 *
 * It never throws. A message that cannot be sent is recorded as failed and logged; it
 * must not undo the booking or the decision that caused it.
 *
 * One-time codes do not go through here, so a code is never stored.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger("Notifications");

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: MessageSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async notify(input: NotifyInput): Promise<"sent" | "failed" | "skipped"> {
    if (!input.recipient) return "skipped";
    let id: string;
    try {
      const row = await this.prisma.notification.create({
        data: {
          userId: input.userId ?? null,
          event: input.event,
          channel: input.channel,
          recipient: input.recipient,
          payload: input.variables,
          status: "queued",
          dedupeKey: input.dedupeKey ?? null,
        },
        select: { id: true },
      });
      id = row.id;
    } catch (error) {
      // P2002 = this dedupe key was already used: the message went out before.
      if ((error as { code?: string }).code === "P2002") return "skipped";
      this.logger.error(`Could not record the "${input.event}" notification: ${String(error)}`);
      return "failed";
    }

    try {
      await this.sender.send({ channel: input.channel, to: input.recipient, template: input.event, variables: input.variables });
      await this.prisma.notification.update({ where: { id }, data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } } });
      this.logger.log({ notification: true, event: input.event, channel: input.channel, status: "sent", notificationId: id });
      return "sent";
    } catch (error) {
      const reason = String((error as Error).message ?? error).slice(0, 500);
      await this.prisma.notification.update({ where: { id }, data: { status: "failed", lastError: reason, attempts: { increment: 1 } } }).catch(() => undefined);
      this.logger.error({ notification: true, event: input.event, channel: input.channel, status: "failed", notificationId: id, reason });
      return "failed";
    }
  }

  /**
   * Tells the traveller (and, for a confirmed booking, the partner's owner) about a
   * booking. Email is used when the person has one; otherwise SMS when the template
   * has SMS wording.
   */
  async bookingEvent(bookingId: string, event: BookingEvent): Promise<void> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          reference: true,
          startsAt: true,
          service: { select: { title: true } },
          traveler: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
          provider: { select: { members: { where: { role: "owner", status: "active" }, take: 1, select: { user: { select: { id: true, email: true } } } } } },
        },
      });
      if (!booking) return;
      const variables = {
        reference: booking.reference,
        service: booking.service.title,
        date: IST_DATE.format(booking.startsAt),
        name: booking.traveler?.profile?.fullName ?? "traveller",
        link: `${this.env.PUBLIC_WEB_URL}/trips/${booking.reference}`,
      };

      const traveller = booking.traveler;
      if (traveller?.email) {
        await this.notify({ event, channel: "email", recipient: traveller.email, userId: traveller.id, variables, dedupeKey: `${event}:${booking.reference}:traveller` });
      } else if (traveller?.phone && event !== "booking_requested") {
        await this.notify({ event, channel: "sms", recipient: traveller.phone, userId: traveller.id, variables, dedupeKey: `${event}:${booking.reference}:traveller` });
      }

      const owner = booking.provider.members[0]?.user;
      if (event === "booking_confirmed" && owner?.email) {
        await this.notify({
          event: "partner_new_booking",
          channel: "email",
          recipient: owner.email,
          userId: owner.id,
          variables: { ...variables, link: `${this.env.PUBLIC_WEB_URL}/partner/bookings` },
          dedupeKey: `partner_new_booking:${booking.reference}`,
        });
      }
    } catch (error) {
      this.logger.error(`Could not notify about booking ${bookingId} (${event}): ${String(error)}`);
    }
  }

  /** Tells the partner's owner that the team decided on their application. */
  async providerDecision(providerId: string, decision: string): Promise<void> {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: {
          displayName: true,
          members: { where: { role: "owner", status: "active" }, take: 1, select: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } } },
        },
      });
      const owner = provider?.members[0]?.user;
      if (!provider || !owner?.email) return;
      await this.notify({
        event: "provider_application_decided",
        channel: "email",
        recipient: owner.email,
        userId: owner.id,
        variables: { name: owner.profile?.fullName ?? "partner", business: provider.displayName, decision, link: `${this.env.PUBLIC_WEB_URL}/partner` },
      });
    } catch (error) {
      this.logger.error(`Could not notify provider ${providerId} about "${decision}": ${String(error)}`);
    }
  }
}
