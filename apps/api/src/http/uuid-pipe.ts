import type { PipeTransform } from "@nestjs/common";
import { notFound } from "./app-error.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `@Param("userId", UuidPipe)`. A malformed ID cannot name anything, so it is a plain 404. */
export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw notFound();
    return value.toLowerCase();
  }
}
