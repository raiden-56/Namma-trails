import { HttpStatus, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";
import { ApiError } from "../errors/api-error.js";

/**
 * Validates a request body/query with a shared Zod schema from @kt/domain.
 * Usage: `@Body(new ZodPipe(providerBusinessSchema)) body: ProviderBusinessInput`
 */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "VALIDATION_FAILED",
        "Some fields need attention",
        result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      );
    }
    return result.data;
  }
}
