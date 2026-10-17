import { INGEST_ERRORS, type IngestErrorCode } from "@didban/contracts";
import { AppError } from "../../http/app-error.js";

/** A spec §6.5 ingestion error: status from the shared table, stable code, fixed message. */
export function ingestError(
  code: IngestErrorCode,
  message: string,
  headers: Record<string, string> = {},
): AppError {
  return new AppError(INGEST_ERRORS[code].status, code, message, headers);
}
