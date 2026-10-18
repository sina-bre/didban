// `events.event_id` is a uuid column; the SDK may send a UUIDv7 or a ULID (spec §6.2). A ULID is
// the same 128 bits in Crockford base32, so it maps to exactly one UUID and dedupes like one.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_LENGTH = 26;

export function toEventUuid(eventId: string): string {
  if (eventId.length !== ULID_LENGTH) return eventId.toLowerCase();
  let value = 0n;
  for (const char of eventId.toUpperCase()) value = value * 32n + BigInt(CROCKFORD.indexOf(char));
  const hex = value.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
