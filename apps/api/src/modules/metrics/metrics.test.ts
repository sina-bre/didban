import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, sendEvents } from "../../test-support/ingest-events.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";

const TOKEN = "test-metrics-token-0123456789abcdef";
type App = Awaited<ReturnType<typeof startTestApp>>;
let t: App;

const scrape = (authorization?: string) =>
  t.send({ method: "GET", url: "/metrics", headers: authorization ? { authorization } : {} });

/** The value of one sample line, e.g. `didban_ingest_requests_total{status="200",code=""}`. */
function sample(body: string, series: string): number | undefined {
  const line = body.split("\n").find((l) => l.startsWith(`${series} `));
  return line === undefined ? undefined : Number(line.slice(series.length + 1));
}

beforeEach(async () => {
  await resetDb();
  t = await startTestApp({ METRICS_TOKEN: TOKEN });
});
afterEach(() => t.close());

describe("GET /metrics (spec §15)", () => {
  it("needs the bearer token and is not under /api/v1", async () => {
    expect((await scrape()).statusCode).toBe(401);
    expect((await scrape("Bearer wrong-token-0123456789abcdef0123")).statusCode).toBe(401);
    expect((await t.get("/metrics", { authorization: `Bearer ${TOKEN}` })).statusCode).toBe(404);
    const ok = await scrape(`Bearer ${TOKEN}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(ok.body).toContain("nodejs_eventloop_lag_seconds");
    expect(ok.body).toContain("process_resident_memory_bytes");
    expect(ok.body).toContain("didban_db_pool_max 2");
  });

  it("answers 404 when no token is configured", async () => {
    await t.close();
    t = await startTestApp();
    expect((await scrape(`Bearer ${TOKEN}`)).statusCode).toBe(404);
  });
});

describe("metric values", () => {
  it("counts ingest requests, events, rejections, filters and transactions", async () => {
    const target = await seedIngestTarget(t.sql);
    const old = page("/old", 40 * 86_400_000);
    expect((await sendEvents(t, target.browserKey, [page("/a"), old])).statusCode).toBe(200);
    await sendEvents(t, target.browserKey, [page("/bot")], { userAgent: "curl/8.0" });
    await sendEvents(t, "dbn_wb_nope", [page("/a")]);
    const body = (await scrape(`Bearer ${TOKEN}`)).body;
    expect(sample(body, 'didban_ingest_requests_total{status="200",code=""}')).toBe(2);
    expect(
      sample(body, 'didban_ingest_requests_total{status="401",code="INVALID_WRITE_KEY"}'),
    ).toBe(1);
    expect(sample(body, 'didban_ingest_events_total{outcome="accepted",code=""}')).toBe(2);
    expect(
      sample(body, 'didban_ingest_events_total{outcome="rejected",code="EVENT_TOO_OLD"}'),
    ).toBe(1);
    expect(sample(body, 'didban_ingest_filtered_total{code="BOT_FILTERED"}')).toBe(1);
    expect(sample(body, "didban_ingest_request_duration_seconds_count")).toBe(3);
    expect(
      sample(
        body,
        'didban_db_transaction_duration_seconds_count{mode="read_write",outcome="commit"}',
      ),
    ).toBe(1);
    expect(sample(body, 'didban_db_pool_transactions{state="waiting"}')).toBe(0);
  });

  it("reports job last-success timestamps from job_runs", async () => {
    await t.sql`INSERT INTO job_runs (job, last_started_at, last_success_at, last_rows)
                VALUES ('retention', to_timestamp(1800000000), to_timestamp(1800000060), 42)`;
    const body = (await scrape(`Bearer ${TOKEN}`)).body;
    expect(sample(body, 'didban_job_last_success_timestamp_seconds{job="retention"}')).toBe(
      1800000060,
    );
    expect(sample(body, 'didban_job_last_rows{job="retention"}')).toBe(42);
    expect(sample(body, 'didban_job_failing{job="retention"}')).toBe(0);
  });
});
