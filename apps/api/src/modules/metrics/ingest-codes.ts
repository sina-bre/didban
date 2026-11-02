import { EVENT_REJECTION_CODES, INGEST_ERRORS } from "@didban/contracts";
import type { Metrics } from "./metrics.js";

// Every code IngestDiagnostics records (the Data Health codes) also lands in a metric. Batch
// errors are already counted per request (`didban_ingest_requests_total{code}`), so skip them.
const REJECTIONS = new Set<string>(EVENT_REJECTION_CODES);
const NOT_EVENT_COUNTS = new Set(["PAGES_SEEN_OVERFLOW"]);

export function countIngestCode(metrics: Metrics, code: string, count: number): void {
  if (code in INGEST_ERRORS || NOT_EVENT_COUNTS.has(code)) return;
  if (code === "DUPLICATE_EVENT")
    metrics.ingestEvents.inc({ outcome: "duplicate", code: "" }, count);
  else if (REJECTIONS.has(code)) metrics.ingestEvents.inc({ outcome: "rejected", code }, count);
  else metrics.ingestFiltered.inc({ code }, count);
}
