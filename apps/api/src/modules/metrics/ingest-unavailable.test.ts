import postgres from "postgres";
import { afterEach, beforeEach, expect, it } from "vitest";
import { page, sendEvents } from "../../test-support/ingest-events.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedIngestTarget } from "../../test-support/seed-ingest.js";
import { startTestApp } from "../../test-support/test-app.js";
import { requireVar } from "../../test-support/test-env.js";

// Spec §6.4/§7 step 8: a lock or timeout failure mid-batch is a 503 the SDK retries, nothing is
// kept, and /metrics shows the cause (the 6b rolling-restart 503s were this path).
const TOKEN = "test-metrics-token-0123456789abcdef";
let t: Awaited<ReturnType<typeof startTestApp>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp({ METRICS_TOKEN: TOKEN });
});
afterEach(() => t.close());

it("answers 503 on a lock failure, rolls back, and counts the cause", async () => {
  const target = await seedIngestTarget(t.sql);
  const admin = postgres(requireVar("TEST_MIGRATION_DATABASE_URL"), { max: 1, onnotice: () => {} });
  await admin`CREATE FUNCTION lock_visit() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'injected lock failure' USING ERRCODE = 'lock_not_available'; END $$`;
  await admin`CREATE TRIGGER lock_visit BEFORE INSERT ON visits FOR EACH ROW EXECUTE FUNCTION lock_visit()`;
  try {
    const res = await sendEvents(t, target.browserKey, [page("/x")]);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("SERVICE_UNAVAILABLE");
    const [row] = await t.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM events`;
    expect(row?.n).toBe(0);
  } finally {
    await admin`DROP TRIGGER lock_visit ON visits`;
    await admin`DROP FUNCTION lock_visit()`;
    await admin.end();
  }
  const metrics = await t.send({
    method: "GET",
    url: "/metrics",
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  expect(metrics.body).toContain('didban_ingest_unavailable_total{cause="55P03"} 1');
  expect(metrics.body).toContain(
    'didban_ingest_requests_total{status="503",code="SERVICE_UNAVAILABLE"} 1',
  );
  expect(metrics.body).toContain(
    'didban_db_transaction_duration_seconds_count{mode="read_write",outcome="rollback"} 1',
  );
});
