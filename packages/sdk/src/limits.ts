// The few contract constants the SDK needs (spec §6.2, §6.5). Copied, not imported, so the bundle
// carries only these; test/contract.test.ts fails if any value drifts from packages/contracts.

export const SCHEMA_VERSION = 1;
export const MAX_EVENTS_PER_BATCH = 50;
export const DEFAULT_BATCH_SIZE = 20;
export const MAX_BEACON_BYTES = 60 * 1024;
export const MAX_URL_LENGTH = 2048;
export const MAX_TITLE_LENGTH = 300;
export const MAX_ID_LENGTH = 128;
export const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
export const RETRYABLE_HTTP_STATUSES = [408, 429, 500, 502, 503, 504];
