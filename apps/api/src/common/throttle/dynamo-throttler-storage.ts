import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Logger } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";

interface ThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Rate-limit counters kept in Amazon DynamoDB (setting RATE_LIMIT_STORE=dynamodb).
 *
 * The default counters live in the memory of one API process. With auto scaling there
 * are several processes, so each would allow the full limit on its own: three tasks
 * would let a visitor try three times as many passwords. A shared counter fixes that,
 * without paying for a Redis server.
 *
 * How it counts: time is cut into windows as long as the limit's period (for example one
 * minute). Each visitor + route + window is one item, and every request adds 1 to it in a
 * single atomic write. The item removes itself after the window (time to live).
 *
 * Cost: one small write per API request, billed per request.
 *
 * If DynamoDB cannot be reached, the request is allowed and the error is logged. A
 * problem with the counter must not take the whole site down.
 */
export class DynamoThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger("RateLimit");

  constructor(
    private readonly db: Pick<DynamoDBDocumentClient, "send">,
    private readonly table: string,
  ) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerRecord> {
    const now = Date.now();
    const windowStart = Math.floor(now / ttl) * ttl;
    const windowEnd = windowStart + ttl;
    const secondsLeft = Math.max(1, Math.ceil((windowEnd - now) / 1000));
    try {
      const result = await this.db.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { pk: `RL#${throttlerName}#${key}#${windowStart}` },
          UpdateExpression: "ADD hits :one SET #ttl = if_not_exists(#ttl, :expires)",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          // Kept a little past the window (and past a longer block time) so late requests still see it.
          ExpressionAttributeValues: { ":one": 1, ":expires": Math.ceil((windowEnd + Math.max(blockDuration, 60_000)) / 1000) },
          ReturnValues: "UPDATED_NEW",
        }),
      );
      const totalHits = Number(result.Attributes?.hits ?? 1);
      const isBlocked = totalHits > limit;
      return { totalHits, timeToExpire: secondsLeft, isBlocked, timeToBlockExpire: isBlocked ? secondsLeft : 0 };
    } catch (error) {
      this.logger.error(`Rate-limit counter unavailable, allowing the request: ${String(error)}`);
      return { totalHits: 1, timeToExpire: secondsLeft, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
