// Abuse cases of DoD 7 beyond `abusive`: oversized bodies, a disallowed Origin, a bot flood (many
// IPs, crawler UA: filtered, answered 200) and a revoked-looking key, mixed with real SDK batches.
import { batchBody, SITE, visitor } from "./batch.mjs";

const PATH = "/api/v1/ingest/batch";
const OVERSIZED = "x".repeat(130 * 1024); // LIMITS.maxBodyBytes is 128 KiB
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function request(writeKey, { ip, ua, origin = SITE, body }) {
  const headers = { "content-type": "text/plain;charset=UTF-8", origin, "user-agent": ua };
  headers["x-forwarded-for"] = ip;
  return { method: "POST", path: PATH, headers, body: body ?? batchBody(writeKey, 5, 0) };
}

export function hostileTraffic(writeKey) {
  let n = 0;
  const kinds = [
    () => request(writeKey, { ...visitor(n), body: `{"pad":"${OVERSIZED}"}` }),
    () => request(writeKey, { ...visitor(n), origin: "https://evil.example" }),
    () => request(writeKey, { ip: visitor(n).ip, ua: BOT_UA }),
    () => request(writeKey, { ...visitor(n) }), // real traffic must still get through
  ];
  return () => {
    n += 1;
    return kinds[n % kinds.length]();
  };
}
