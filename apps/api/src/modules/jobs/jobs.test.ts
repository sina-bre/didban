import { afterEach, beforeEach, expect, it } from "vitest";
import { anonymousVisitorId } from "../../domain/visitor-id.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedOrg, seedProject } from "../../test-support/seed-org.js";
import { seedServerEvent, seedVisit, type Target } from "../../test-support/seed-stats.js";
import { startTestApp } from "../../test-support/test-app.js";
import type { JobContext } from "./chunked-delete.js";
import { runDeletions } from "./deletion-job.js";
import { withJobLock } from "./job-lock.js";
import { JobRunner } from "./job-runner.js";
import { runRetention } from "./retention-job.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let a: Target;
let ctx: JobContext;
const NOW = new Date("2026-10-31T12:00:00Z");
const page = { pages: ["/", "/a", "/b"] };

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  const projectId = await seedProject(t.sql, await seedOrg(t.sql, "org"), "site");
  const [env] = await t.sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name) VALUES (${projectId}, 'production') RETURNING id`;
  a = { projectId, environmentId: env?.id ?? "" };
  ctx = { sql: t.sql, chunk: 2, pauseMs: 0, stopping: () => false };
});
afterEach(() => t.close());

const eventCount = async (where = t.sql`true`) =>
  (await t.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM events WHERE ${where}`)[0]?.n;
const visitCount = async () =>
  (await t.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM visits`)[0]?.n;
const request = (values: Record<string, unknown>) =>
  t.sql`INSERT INTO data_deletions ${t.sql({ projectId: a.projectId, ...values })}`;

it("retention: deletes expired events and visits in chunks, keeps the rest and other projects", async () => {
  await t.sql`UPDATE projects SET retention_days = 30 WHERE id = ${a.projectId}`;
  await seedVisit(t.sql, a, { ...page, visitor: 1, at: "2026-09-20T09:00:00Z" });
  await seedVisit(t.sql, a, { ...page, visitor: 2, at: "2026-10-20T09:00:00Z" });
  const other = await seedProject(t.sql, await seedOrg(t.sql, "forever"), "kept");
  const [env] = await t.sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name) VALUES (${other}, 'p') RETURNING id`;
  await seedVisit(
    t.sql,
    { projectId: other, environmentId: env?.id ?? "" },
    { ...page, visitor: 3, at: "2020-01-01T00:00:00Z" },
  );
  await t.sql`INSERT INTO ingestion_diagnostics (project_id, environment_id, hour, code, count) VALUES
    (${a.projectId}, ${a.environmentId}, '2026-10-01T00:00:00Z', 'INVALID_EVENT', 1),
    (${a.projectId}, ${a.environmentId}, '2026-10-30T00:00:00Z', 'INVALID_EVENT', 1)`;
  expect(await runRetention(ctx, NOW)).toBe(3 + 1 + 1);
  expect([await eventCount(), await visitCount()]).toEqual([6, 2]);
  expect(
    await eventCount(t.sql`occurred_at < '2026-10-01'::date AND project_id = ${a.projectId}`),
  ).toBe(0);
  const [diag] = await t.sql`SELECT count(*)::int AS n FROM ingestion_diagnostics`;
  expect(diag?.n).toBe(1);
});

it("range deletion: events in [from, to) and visits started there; counters on the request", async () => {
  for (const [visitor, at] of [
    [1, "2026-10-01T10:00:00Z"],
    [2, "2026-10-03T10:00:00Z"],
    [3, "2026-10-09T10:00:00Z"],
  ] as const) {
    await seedVisit(t.sql, a, { ...page, visitor, at });
  }
  await request({
    kind: "range",
    fromAt: new Date("2026-10-02T00:00:00Z"),
    toAt: new Date("2026-10-09T00:00:00Z"),
  });
  expect(await runDeletions(ctx)).toBe(4);
  expect([await eventCount(), await visitCount()]).toEqual([6, 2]);
  const [row] =
    await t.sql`SELECT status, events_deleted::int, visits_deleted::int FROM data_deletions`;
  expect(row).toEqual({ status: "done", eventsDeleted: 3, visitsDeleted: 1 });
});

it("visitor deletion: browser and server events with the visitor's hash, and its visits", async () => {
  const id = anonymousVisitorId(a.projectId, "aid-1");
  const visit = await seedVisit(t.sql, a, { ...page, visitor: 1, at: "2026-10-01T10:00:00Z" });
  await seedVisit(t.sql, a, { ...page, visitor: 2, at: "2026-10-01T11:00:00Z" });
  await seedServerEvent(t.sql, a, "2026-10-04T10:00:00Z", "purchase");
  await t.sql`UPDATE visits SET visitor_id = ${id} WHERE visit_id = ${visit}`;
  await t.sql`UPDATE events SET visitor_id = ${id} WHERE visit_id = ${visit} OR source = 2`;
  await request({ kind: "visitor", visitorId: id });
  await runDeletions(ctx);
  expect([await eventCount(), await visitCount()]).toEqual([3, 1]);
});

it("a stop between chunks keeps the request running; the next run resumes and finishes", async () => {
  await seedVisit(t.sql, a, { ...page, visitor: 1, at: "2026-10-01T10:00:00Z" });
  await seedVisit(t.sql, a, { ...page, visitor: 1, at: "2026-10-05T10:00:00Z" });
  await request({ kind: "range", fromAt: new Date("2026-10-01"), toAt: new Date("2026-11-01") });
  let checks = 0;
  await expect(runDeletions({ ...ctx, stopping: () => ++checks > 3 })).rejects.toThrow("stopped");
  const [mid] = await t.sql`SELECT status, events_deleted::int AS n, cursor_at FROM data_deletions`;
  expect(mid?.status).toBe("running");
  expect(mid?.n).toBeGreaterThan(0);
  await runDeletions(ctx);
  const [end] = await t.sql`SELECT status, events_deleted::int AS n FROM data_deletions`;
  expect(end).toEqual({ status: "done", n: 6 });
  expect(await eventCount()).toBe(0);
});

it("a failing request is marked failed and the queue moves on", async () => {
  await seedVisit(t.sql, a, { ...page, visitor: 1, at: "2026-10-01T10:00:00Z" });
  await request({ kind: "user", userId: "u-1", createdAt: new Date("2026-10-01") });
  await request({ kind: "user", userId: "u-2", createdAt: new Date("2026-10-02") });
  let checks = 0;
  const failOnce = () => {
    checks += 1;
    if (checks === 2) throw new Error("disk on fire");
    return false;
  };
  await runDeletions({ ...ctx, stopping: failOnce });
  const rows = await t.sql`SELECT status, error FROM data_deletions ORDER BY created_at`;
  expect(rows.map((r) => [r.status, r.error])).toEqual([
    ["failed", "disk on fire"],
    ["done", null],
  ]);
});

it("one job process at a time; the runner records runs and retention waits 23 h", async () => {
  let inner: boolean | undefined;
  await withJobLock(t.sql, async () => {
    inner = await withJobLock(t.sql, async () => undefined);
  });
  expect(inner).toBe(false);
  const runner = t.app.get(JobRunner);
  await runner.tick();
  const [first] = await t.sql`SELECT last_started_at FROM job_runs WHERE job = 'retention'`;
  await runner.tick();
  const runs = await t.sql`SELECT job, last_started_at, last_error FROM job_runs ORDER BY job`;
  expect(runs.map((r) => [r.job, r.lastError])).toEqual([
    ["data_deletion", null],
    ["retention", null],
  ]);
  expect(runs[1]?.lastStartedAt).toEqual(first?.lastStartedAt);
});
