import { afterEach, beforeEach, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { seedVisit, type Target } from "../../test-support/seed-stats.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

// Stage 4 gate: aggregation boundaries — DST transitions in the reporting time zone, half-hour
// zones, midnight UTC visitor rotation, range edges, totals that are not bucket sums.

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let target: Target;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  const projectId = tenants.ids.projectA;
  const [env] = await t.sql<{ id: string }[]>`
    INSERT INTO environments (project_id, name) VALUES (${projectId}, 'production') RETURNING id`;
  target = { projectId, environmentId: env?.id ?? "" };
});
afterEach(() => t.close());

async function series(timezone: string, params: Record<string, string>) {
  await t.sql`UPDATE projects SET reporting_timezone = ${timezone} WHERE id = ${target.projectId}`;
  const url = `/projects/${target.projectId}/stats/timeseries?${new URLSearchParams(params)}`;
  const res = await call(t, "GET", url, tenants.cookies.ownerA);
  expect(res.statusCode).toBe(200);
  return res.json() as { points: { start: string; pageviews: number; visitors: number }[] };
}
const view = (visitor: number, at: string) =>
  seedVisit(t.sql, target, { visitor, at, pages: ["/"] });
const pairs = (points: { start: string; pageviews: number }[]) =>
  points.map((p) => [p.start.slice(0, 16), p.pageviews]);

it("timeseries: Europe/Berlin fall-back day has 25 hours; 23:30 local stays on that day", async () => {
  await view(1, "2026-10-25T22:30:00Z"); // 23:30 CET, Oct 25
  await view(2, "2026-10-25T23:30:00Z"); // 00:30 CET, Oct 26
  const res = await series("Europe/Berlin", {
    from: "2026-10-24T22:00:00Z",
    to: "2026-10-26T23:00:00Z",
    interval: "day",
  });
  expect(pairs(res.points)).toEqual([
    ["2026-10-24T22:00", 1],
    ["2026-10-25T23:00", 1],
  ]);
});

it("timeseries: the repeated local hour at fall-back is two buckets, not one", async () => {
  await view(1, "2026-10-25T00:30:00Z"); // 02:30 CEST
  await view(2, "2026-10-25T01:30:00Z"); // 02:30 CET
  const res = await series("Europe/Berlin", {
    from: "2026-10-25T00:00:00Z",
    to: "2026-10-25T03:00:00Z",
    interval: "hour",
  });
  expect(pairs(res.points)).toEqual([
    ["2026-10-25T00:00", 1],
    ["2026-10-25T01:00", 1],
    ["2026-10-25T02:00", 0],
  ]);
});

it("timeseries: spring-forward day has 23 hours (America/New_York)", async () => {
  await view(1, "2026-03-09T03:30:00Z"); // 23:30 EDT, Mar 8
  const res = await series("America/New_York", {
    from: "2026-03-08T05:00:00Z",
    to: "2026-03-10T04:00:00Z",
    interval: "day",
  });
  expect(pairs(res.points)).toEqual([
    ["2026-03-08T05:00", 1],
    ["2026-03-09T04:00", 0],
  ]);
});

it("timeseries: Asia/Tehran days start at 20:30 UTC", async () => {
  await view(1, "2026-10-18T20:29:00Z");
  await view(2, "2026-10-18T20:31:00Z");
  const res = await series("Asia/Tehran", {
    from: "2026-10-17T20:30:00Z",
    to: "2026-10-19T20:30:00Z",
    interval: "day",
  });
  expect(pairs(res.points)).toEqual([
    ["2026-10-17T20:30", 1],
    ["2026-10-18T20:30", 1],
  ]);
});

it("timeseries: midnight UTC: one cookieless person is two daily visitors; totals are distinct counts", async () => {
  await view(1, "2026-10-06T23:50:00Z");
  await view(2, "2026-10-07T00:10:00Z"); // same person, new daily ID after the salt rotation
  await view(3, "2026-10-07T09:00:00Z");
  await view(3, "2026-10-07T15:00:00Z"); // same visitor, second visit, later bucket
  const range = { from: "2026-10-06T00:00:00Z", to: "2026-10-08T00:00:00Z" };
  const daily = await series("UTC", { ...range, interval: "day" });
  expect(daily.points.map((p) => p.visitors)).toEqual([1, 2]);
  const hourly = await series("UTC", {
    from: "2026-10-07T00:00:00Z",
    to: "2026-10-08T00:00:00Z",
    interval: "hour",
  });
  const bucketSum = hourly.points.reduce((sum, p) => sum + p.visitors, 0);
  const url = `/projects/${target.projectId}/stats/overview?from=2026-10-07T00:00:00Z&to=2026-10-08T00:00:00Z`;
  const total = (await call(t, "GET", url, tenants.cookies.ownerA)).json().metrics.visitors.value;
  expect([bucketSum, total]).toEqual([3, 2]);
});

it("timeseries: previous period series has the same number of buckets", async () => {
  const res = (await series("UTC", {
    from: "2026-10-05T00:00:00Z",
    to: "2026-10-12T00:00:00Z",
    compare: "previous_period",
  })) as unknown as { points: unknown[]; previous: { start: string }[] };
  expect(res.points).toHaveLength(7);
  expect(res.previous.map((p) => p.start.slice(0, 10))[0]).toBe("2026-09-28");
  expect(res.previous).toHaveLength(7);
});
