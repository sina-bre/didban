// Spec §4 + §9.2: small-integer codes stored in `events` / `visits`. The dashboard labels them;
// codes are append-only (never renumber a stored value).

/** Channel grouping (spec §4, rules in apps/api/data/channels.json). */
export const CHANNELS = {
  direct: 0,
  organicSearch: 1,
  paidSearch: 2,
  social: 3,
  email: 4,
  referral: 5,
} as const;
export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

/** `device_type`; NULL when the user agent does not say. */
export const DEVICE_TYPES = { desktop: 1, mobile: 2, tablet: 3, tv: 4 } as const;
export type DeviceType = (typeof DEVICE_TYPES)[keyof typeof DEVICE_TYPES];

/** `screen_class` from the reported screen width (CSS px): upper bounds, exclusive. */
export const SCREEN_CLASSES = [
  { code: 1, name: "phone", maxWidth: 576 },
  { code: 2, name: "tablet", maxWidth: 992 },
  { code: 3, name: "laptop", maxWidth: 1440 },
  { code: 4, name: "desktop", maxWidth: Number.POSITIVE_INFINITY },
] as const;
