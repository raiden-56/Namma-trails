import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";

export interface AuditEntry {
  actorId: string | null;
  actorType: "user" | "admin" | "provider" | "system";
  action: string;
  entityType: string;
  entityId: string;
  providerId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  requestId?: string | null;
}

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Writes append-only audit records. Pass the transaction client so the audit row commits with the change.
 *
 * Each record is also written as one log line (without the before/after data, which may
 * hold personal details). On AWS those lines land in CloudWatch, where they can be
 * searched, counted and alarmed on.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx: Tx = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorType: entry.actorType,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        providerId: entry.providerId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: entry.ipAddress ?? null,
        requestId: entry.requestId ?? null,
      },
    });
    this.logger.log({
      audit: true,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      providerId: entry.providerId ?? null,
      requestId: entry.requestId ?? null,
    });
  }
}
