// Abuse cases of DoD 7 beyond `abusive`: oversized bodies; a disallowed Origin and a bot flood
// (many IPs, crawler UA: filtered, answered 200) mixed with real SDK batches.
import { batchBody, SITE, visitor } from "./batch.mjs";

const PATH = "/api/v1/ingest/batch";
const OVERSIZED = "x".repeat(130 * 1024); // LIMITS.maxBodyBytes is 128 KiB
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function request(writeKey, { ip, ua, origin = SITE, body }) {
  const headers = { "content-type": "text/plain;charset=UTF-8", origin, "user-agent": ua };
  headers["x-forwarded-for"] = ip;
  return { method: "POST", path: PATH, headers, body: body ?? batchBody(writeKey, 5, 0) };
}

/** 130 KiB bodies only: Fastify must answer 413 without reading them into the app. */
export function oversizedTraffic(writeKey) {
  let n = 0;
  return () => request(writeKey, { ...visitor(n++), body: `{"pad":"${OVERSIZED}"}` });
}

export function hostileTraffic(writeKey) {
  let n = 0;
  const kinds = [
    () => request(writeKey, { ...visitor(n), origin: "https://evil.example" }),
    () => request(writeKey, { ip: visitor(n).ip, ua: BOT_UA }),
    () => request(writeKey, { ...visitor(n) }), // real traffic must still get through
  ];
  return () => {
    n += 1;
    return kinds[n % kinds.length]();
  };
}
