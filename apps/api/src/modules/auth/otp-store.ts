import { randomUUID } from "node:crypto";
import { PutCommand, QueryCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { OtpChannel, OtpPurpose } from "../../generated/prisma/client.js";
import type { PrismaService } from "../../prisma/prisma.service.js";

export interface NewOtp {
  channel: OtpChannel;
  destination: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  ip?: string | undefined;
}

export interface StoredOtp {
  /** Opaque handle the store needs to update this one code. */
  ref: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
}

const MAX_ATTEMPTS = 5;

/**
 * Where one-time codes are kept. Only the hash of a code is ever stored.
 *
 * Two stores exist (setting OTP_STORE):
 *   postgres  the otp_verifications table. The default; nothing extra to run locally.
 *   dynamodb  an Amazon DynamoDB table. Codes are short-lived, read by one key and never
 *             joined to anything, which is exactly what DynamoDB is good and cheap at.
 *             Old codes are removed by the table itself (time to live), so nothing piles up.
 */
export abstract class OtpStore {
  /** How many codes were requested for this destination and purpose since the given time. */
  abstract countSince(destination: string, purpose: OtpPurpose, since: Date): Promise<number>;
  abstract create(otp: NewOtp): Promise<void>;
  /** The newest code that is not used and not expired, or null. */
  abstract latestActive(destination: string, purpose: OtpPurpose, now: Date): Promise<StoredOtp | null>;
  abstract recordFailedAttempt(otp: StoredOtp): Promise<void>;
  /** Marks the code as used. Returns false when someone else used it first. */
  abstract consume(otp: StoredOtp, now: Date): Promise<boolean>;
}

export class PrismaOtpStore extends OtpStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  countSince(destination: string, purpose: OtpPurpose, since: Date): Promise<number> {
    return this.prisma.otpVerification.count({ where: { destination, purpose, createdAt: { gte: since } } });
  }

  async create(otp: NewOtp): Promise<void> {
    await this.prisma.otpVerification.create({
      data: { channel: otp.channel, destination: otp.destination, purpose: otp.purpose, codeHash: otp.codeHash, expiresAt: otp.expiresAt, ipAddress: otp.ip ?? null },
    });
  }

  async latestActive(destination: string, purpose: OtpPurpose, now: Date): Promise<StoredOtp | null> {
    const row = await this.prisma.otpVerification.findFirst({
      where: { destination, purpose, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    return row ? { ref: row.id, codeHash: row.codeHash, attempts: row.attempts, maxAttempts: row.maxAttempts } : null;
  }

  async recordFailedAttempt(otp: StoredOtp): Promise<void> {
    await this.prisma.otpVerification.update({ where: { id: otp.ref }, data: { attempts: { increment: 1 } } });
  }

  async consume(otp: StoredOtp, now: Date): Promise<boolean> {
    const { count } = await this.prisma.otpVerification.updateMany({ where: { id: otp.ref, consumedAt: null }, data: { consumedAt: now } });
    return count === 1;
  }
}

/**
 * DynamoDB layout (one table):
 *   pk   "OTP#<purpose>#<destination>"      all codes of one person for one purpose
 *   sk   "<created ISO time>#<random>"      so the newest sorts last
 *   ttl  seconds since 1970; DynamoDB deletes the item some time after this
 *
 * An item is kept for at least an hour, because the "at most 5 codes an hour" rule
 * counts the items of the last hour.
 */
export class DynamoOtpStore extends OtpStore {
  constructor(
    private readonly db: Pick<DynamoDBDocumentClient, "send">,
    private readonly table: string,
  ) {
    super();
  }

  private pk(destination: string, purpose: OtpPurpose): string {
    return `OTP#${purpose}#${destination}`;
  }

  async countSince(destination: string, purpose: OtpPurpose, since: Date): Promise<number> {
    const result = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "pk = :pk AND sk >= :since",
        ExpressionAttributeValues: { ":pk": this.pk(destination, purpose), ":since": since.toISOString() },
        Select: "COUNT",
        ConsistentRead: true,
      }),
    );
    return result.Count ?? 0;
  }

  async create(otp: NewOtp): Promise<void> {
    const now = new Date();
    const keepUntil = Math.max(otp.expiresAt.getTime(), now.getTime() + 3_600_000) + 600_000;
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: this.pk(otp.destination, otp.purpose),
          sk: `${now.toISOString()}#${randomUUID()}`,
          channel: otp.channel,
          codeHash: otp.codeHash,
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          expiresAt: otp.expiresAt.getTime(),
          ipAddress: otp.ip,
          ttl: Math.ceil(keepUntil / 1000),
        },
      }),
    );
  }

  async latestActive(destination: string, purpose: OtpPurpose, now: Date): Promise<StoredOtp | null> {
    const pk = this.pk(destination, purpose);
    const result = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false, // newest first
        Limit: 10,
        ConsistentRead: true,
      }),
    );
    const item = (result.Items ?? []).find((i) => i.consumedAt === undefined && Number(i.expiresAt) > now.getTime());
    if (!item) return null;
    return { ref: JSON.stringify([pk, item.sk]), codeHash: String(item.codeHash), attempts: Number(item.attempts ?? 0), maxAttempts: Number(item.maxAttempts ?? MAX_ATTEMPTS) };
  }

  private key(otp: StoredOtp): { pk: string; sk: string } {
    const [pk, sk] = JSON.parse(otp.ref) as [string, string];
    return { pk, sk };
  }

  async recordFailedAttempt(otp: StoredOtp): Promise<void> {
    await this.db.send(
      new UpdateCommand({
        TableName: this.table,
        Key: this.key(otp),
        UpdateExpression: "ADD attempts :one",
        ExpressionAttributeValues: { ":one": 1 },
      }),
    );
  }

  async consume(otp: StoredOtp, now: Date): Promise<boolean> {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.table,
          Key: this.key(otp),
          UpdateExpression: "SET consumedAt = :now",
          // Only the first caller wins, so a code can never be used twice.
          ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(consumedAt)",
          ExpressionAttributeValues: { ":now": now.getTime() },
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  }
}
