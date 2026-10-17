// Spec §6.2. The server may override numeric limits through env; the SDK inlines these defaults.
export const SCHEMA_VERSION = 1;

export const LIMITS = {
  maxBodyBytes: 128 * 1024,
  maxBeaconBytes: 60 * 1024,
  maxEventsPerBatch: 50,
  sdkDefaultBatchSize: 20,
  maxEventBytes: 8 * 1024,
  maxProperties: 20,
  maxPropertyKeysPerEventName: 50,
  maxPropertyStringLength: 255,
  maxUrlLength: 2048,
  maxTitleLength: 300,
  maxIdLength: 128,
  maxRevenueAbs: 1e9,
  maxVisitorsPerBrowserBatch: 5,
  maxEventAgeHours: 72,
  maxFutureSkewMinutes: 5,
} as const;

export const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
export const PROPERTY_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** The only `$`-prefixed property keys a client may send. */
export const RESERVED_PROPERTIES = { revenue: "$revenue", currency: "$currency" } as const;
