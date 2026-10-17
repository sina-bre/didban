// Spec §6.5. Stable codes: the SDK retry policy and docs/api.md are derived from this table.
export const INGEST_ERRORS = {
  INVALID_JSON: { status: 400, retry: false },
  INVALID_ENVELOPE: { status: 400, retry: false },
  UNSUPPORTED_SCHEMA_VERSION: { status: 400, retry: false },
  BATCH_TOO_LARGE: { status: 400, retry: false },
  TOO_MANY_VISITORS_IN_BATCH: { status: 400, retry: false },
  INVALID_WRITE_KEY: { status: 401, retry: false },
  WRITE_KEY_REVOKED: { status: 401, retry: false },
  ORIGIN_NOT_ALLOWED: { status: 403, retry: false },
  PAYLOAD_TOO_LARGE: { status: 413, retry: false },
  RATE_LIMITED: { status: 429, retry: true },
  QUOTA_EXCEEDED: { status: 429, retry: false },
  INTERNAL_ERROR: { status: 500, retry: true },
  SERVICE_UNAVAILABLE: { status: 503, retry: true },
} as const;

export type IngestErrorCode = keyof typeof INGEST_ERRORS;

/** Per-event rejection codes inside a 200 response (partial success). */
export const EVENT_REJECTION_CODES = ["INVALID_EVENT", "EVENT_IN_FUTURE", "EVENT_TOO_OLD"] as const;
export type EventRejectionCode = (typeof EVENT_REJECTION_CODES)[number];

/** HTTP statuses the SDK retries when there is no error code in the body (plus network errors). */
export const RETRYABLE_HTTP_STATUSES = [408, 429, 500, 502, 503, 504] as const;
