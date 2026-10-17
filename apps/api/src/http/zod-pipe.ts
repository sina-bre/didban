import type { PipeTransform } from "@nestjs/common";
import type { z } from "zod";
import { AppError } from "./app-error.js";

/** The one validation pipe: `@Body(new ZodPipe(schema))`. Schemas come from @didban/contracts. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new AppError(400, "VALIDATION_FAILED", "Invalid request body");
    return result.data;
  }
}
