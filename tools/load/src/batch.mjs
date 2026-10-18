// Batches shaped like `@didban/analytics` output (packages/sdk/src/payload.ts + events.ts):
// text/plain body with the write key, SDK context, UUIDv7 event IDs, page views + custom events.
import { randomBytes } from "node:crypto";

export const SITE = "https://load.didban.test";

const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
];
const PATHS = ["/", "/pricing", "/docs", "/docs/install", "/blog/launch", "/about", "/signup"];
const REFERRERS = [
  undefined,
  undefined,
  "https://www.google.com/",
  "https://news.ycombinator.com/",
];
const CONTEXT = {
  sdk: { name: "@didban/analytics", version: "0.1.0" },
  locale: "en-US",
  screen: { w: 1920, h: 1080 },
  timezone: "Europe/Berlin",
};

const pick = (list, n) => list[n % list.length];

/** UUIDv7 (RFC 9562), same layout as packages/sdk/src/ids.ts. */
export function uuidv7(ms = Date.now()) {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(ms, 0, 6);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
}

/** Visitor `i` of the pool: a stable (IP, user agent) pair, as cookieless identity sees it. */
export function visitor(i) {
  const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
  return { ip, ua: pick(UAS, i) };
}

function event(seq, now) {
  const base = {
    eventId: uuidv7(now),
    occurredAt: new Date(now).toISOString(),
    url: `${SITE}${pick(PATHS, seq)}`,
    properties: {},
    title: "didban load test",
  };
  if (seq % 4 === 3)
    return { ...base, type: "track", name: "signup_click", properties: { plan: "pro" } };
  const referrer = pick(REFERRERS, seq);
  return { ...base, type: "page", ...(referrer ? { referrer } : {}) };
}

/** One batch body (string) of `size` events from a single visitor, `sentAt` = now. */
export function batchBody(writeKey, size, seed) {
  const now = Date.now();
  const events = Array.from({ length: size }, (_, i) => event(seed + i, now));
  return JSON.stringify({
    schemaVersion: 1,
    sentAt: new Date(now).toISOString(),
    writeKey,
    context: CONTEXT,
    events,
  });
}
