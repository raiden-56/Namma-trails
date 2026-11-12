import { Injectable } from "@nestjs/common";
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

/** Writes append-only audit records. Pass the transaction client so the audit row commits with the change. */
@Injectable()
export class AuditService {
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
  }
}
