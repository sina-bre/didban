import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { BROWSER_UA, batchBody, SITE, seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";
import { IngestionFlusher } from "./ingestion-flusher.js";

// Spec §7 steps 3–5 over HTTP: rate limit, quota, validation, and what Data Health gets to see.
let t: Awaited<ReturnType<typeof startTestApp>>;
let target: Awaited<ReturnType<typeof seedIngestTarget>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp({ INGEST_RATE_PER_KEY: "3", INGEST_RATE_PER_IP: "2" });
  target = await seedIngestTarget(t.sql);
});
afterEach(() => t.close());

function ingest(payload: unknown, origin = SITE) {
  return t.send({
    method: "POST",
    url: "/api/v1/ingest/batch",
    payload: JSON.stringify(payload),
    headers: { "content-type": "text/plain", origin, "user-agent": BROWSER_UA },
  });
}
const flush = () => t.app.get(IngestionFlusher).flush();

describe("ingestion: rate limit and quota (spec §7 step 4)", () => {
  it("rate-limits browser keys per IP, with Retry-After", async () => {
    await ingest(batchBody(target.browserKey));
    await ingest(batchBody(target.browserKey));
    const res = await ingest(batchBody(target.browserKey));
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("rate-limits server keys per key only", async () => {
    const send = () =>
      t.send({
        method: "POST",
        url: "/api/v1/ingest/batch",
        payload: JSON.stringify(batchBody(undefined)),
        headers: { "content-type": "application/json", "x-write-key": target.serverKey },
      });
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await send()).json().error.code);
    expect(codes).toEqual([
      "SERVICE_UNAVAILABLE",
      "SERVICE_UNAVAILABLE",
      "SERVICE_UNAVAILABLE",
      "RATE_LIMITED",
    ]);
  });

  it("stops at the organization's daily quota", async () => {
    await t.sql`UPDATE organizations SET daily_event_quota = 10`;
    await t.sql`INSERT INTO project_usage_daily (project_id, day, events)
                VALUES (${target.projectId}, (now() AT TIME ZONE 'UTC')::date, 10)`;
    const res = await ingest(batchBody(target.browserKey));
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("QUOTA_EXCEEDED");
    expect(Number(res.headers["retry-after"])).toBeLessThanOrEqual(86_400);
  });
});

describe("ingestion: validation and diagnostics (spec §7 steps 3, 5)", () => {
  it("rejects unsupported schema versions as a whole", async () => {
    const res = await ingest({ ...batchBody(target.browserKey), schemaVersion: 2 });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
  });

  it("writes rejection counts and rejected origins once flushed", async () => {
    await ingest(batchBody(target.browserKey), "https://evil.example");
    await ingest({ ...batchBody(target.browserKey), schemaVersion: 2 });
    await ingest(batchBody(target.browserKey, [0, 80 * 3_600_000]));
    await flush();
    const counts = await t.sql`
      SELECT code, count FROM ingestion_diagnostics
      WHERE environment_id = ${target.environmentId} ORDER BY code`;
    expect(counts.map((r) => [r.code, r.count])).toEqual([
      ["EVENT_TOO_OLD", 1],
      ["ORIGIN_NOT_ALLOWED", 1],
      ["UNSUPPORTED_SCHEMA_VERSION", 1],
    ]);
    const origins = await t.sql`SELECT origin, count FROM ingestion_rejected_origins`;
    expect(origins.map((r) => [r.origin, r.count])).toEqual([["https://evil.example", 1]]);
  });
});

describe("ingestion: flushed counters (spec §7 step 3, §9.1)", () => {
  it("caps stored rejected origins at 20 per environment and day across flushes", async () => {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 15; i++) {
        const res = await ingest(batchBody(target.browserKey), `https://r${round}-${i}.example`);
        expect(res.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
      }
      await flush();
    }
    const [row] = await t.sql`SELECT count(*)::int AS n FROM ingestion_rejected_origins`;
    expect(row?.n).toBe(20);
  });

  it("flushes key usage into last_used_at", async () => {
    await ingest(batchBody(target.browserKey));
    await flush();
    const rows = await t.sql`SELECT kind FROM api_keys WHERE last_used_at IS NOT NULL`;
    expect(rows.map((r) => r.kind)).toEqual(["write_browser"]);
  });
});
