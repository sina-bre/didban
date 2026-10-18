// Load scenarios (spec §16): sustained ingestion, burst, abusive input. Each request is built
// fresh (new UUIDv7s, sentAt = now). Visitors arrive through one trusted proxy hop (X-Forwarded-For).
import { batchBody, SITE, visitor } from "./batch.mjs";

const PATH = "/api/v1/ingest/batch";
const VISITORS = 5000;

let seq = 0;

function browserRequest(writeKey, size, ip, ua) {
  seq += size;
  const headers = { "content-type": "text/plain;charset=UTF-8", origin: SITE, "user-agent": ua };
  if (ip) headers["x-forwarded-for"] = ip;
  return { method: "POST", path: PATH, headers, body: batchBody(writeKey, size, seq) };
}

function sdkTraffic(writeKey, size) {
  return () => {
    const { ip, ua } = visitor(Math.floor(Math.random() * VISITORS));
    return browserRequest(writeKey, size, ip, ua);
  };
}

/** Malformed JSON, unknown key, and one IP flooding past its per-minute limit, in turn. */
function abusiveTraffic(writeKey) {
  const { ua } = visitor(0);
  const kinds = [
    () => ({ ...browserRequest(writeKey, 1, "10.255.0.1", ua), body: '{"schemaVersion":1,' }),
    () => browserRequest(`dpk_000000000000_${"x".repeat(43)}`, 5, "10.255.0.2", ua),
    () => browserRequest(writeKey, 5, "10.255.0.3", ua),
  ];
  let turn = 0;
  return () => kinds[turn++ % kinds.length]();
}

export const SCENARIOS = {
  sustained: {
    about: "steady SDK traffic: 20 connections, 5-event batches, 5000 visitors",
    options: { connections: 20, duration: 60 },
    build: (key) => sdkTraffic(key, 5),
    eventsPerBatch: 5,
  },
  burst: {
    about: "burst: 200 connections, full 20-event batches (SDK default batch size)",
    options: { connections: 200, duration: 20 },
    build: (key) => sdkTraffic(key, 20),
    eventsPerBatch: 20,
  },
  abusive: {
    about: "abusive: malformed JSON, unknown key, one-IP flood past INGEST_RATE_PER_IP",
    options: { connections: 50, duration: 20 },
    build: (key) => abusiveTraffic(key),
    eventsPerBatch: 5,
  },
};
