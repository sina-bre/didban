import { afterEach, beforeEach, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { seedServerEvent, seedVisit, type Target } from "../../test-support/seed-stats.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

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

const WEEK = { from: "2026-10-05T00:00:00Z", to: "2026-10-12T00:00:00Z" };

function stats(path: "overview" | "timeseries", params: Record<string, string | string[]>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of [value].flat()) query.append(key, v);
  }
  const url = `/projects/${target.projectId}/stats/${path}?${query}`;
  return call(t, "GET", url, tenants.cookies.viewerA);
}

async function seedWeek() {
  // Visitor 1: a bounce, then a 3-page visit with a signup. Visitor 2: two pages from search.
  await seedVisit(t.sql, target, { visitor: 1, at: "2026-10-06T09:00:00Z", pages: ["/"] });
  await seedVisit(t.sql, target, {
    visitor: 1,
    at: "2026-10-07T10:00:00Z",
    pages: ["/", "/pricing", "/signup"],
    tracks: ["signup"],
    properties: { plan: "pro" },
  });
  await seedVisit(t.sql, target, {
    visitor: 2,
    at: "2026-10-08T11:00:00Z",
    pages: ["/docs", "/pricing"],
    channel: 1,
    country: "DE",
  });
  await seedServerEvent(t.sql, target, "2026-10-08T12:00:00Z", "purchase_completed");
}

it("overview: computes the six KPIs (spec §4); server events are no visitors", async () => {
  await seedWeek();
  const res = await stats("overview", WEEK);
  expect(res.statusCode).toBe(200);
  const { meta, metrics } = res.json();
  expect(meta).toMatchObject({ interval: "day", timezone: "UTC", identityMode: "cookieless" });
  const values = Object.fromEntries(
    Object.entries(metrics as Record<string, { value: unknown }>).map(([k, m]) => [k, m.value]),
  );
  expect(values).toEqual({
    visitors: 2,
    visits: 3,
    pageviews: 6,
    viewsPerVisit: 2,
    bounceRate: 0.3333,
    visitDuration: 80, // (0 + 180 + 60) / 3 visits: the zero-length bounce is included
  });
});

it("overview: is [from, to): an event at `to` is out, at `from` is in", async () => {
  await seedVisit(t.sql, target, { visitor: 1, at: WEEK.from, pages: ["/"] });
  await seedVisit(t.sql, target, { visitor: 2, at: WEEK.to, pages: ["/"] });
  const { metrics } = (await stats("overview", WEEK)).json();
  expect([metrics.visitors.value, metrics.visits.value]).toEqual([1, 1]);
});

it("overview: compares with the previous period; change is null when the previous value is 0", async () => {
  await seedWeek();
  await seedVisit(t.sql, target, { visitor: 3, at: "2026-10-01T08:00:00Z", pages: ["/", "/a"] });
  const res = await stats("overview", { ...WEEK, compare: "previous_period" });
  const { meta, metrics } = res.json();
  expect(meta.previous).toEqual({
    from: "2026-09-28T00:00:00.000Z",
    to: WEEK.from.replace("Z", ".000Z"),
  });
  expect(metrics.visitors).toEqual({ value: 2, previous: 1, change: 100 });
  expect(metrics.bounceRate).toEqual({ value: 0.3333, previous: 0, change: null });
});

it("overview: filters by page, property, channel name and country (visits that contain a match)", async () => {
  await seedWeek();
  const visitors = async (filter: string | string[]) =>
    (await stats("overview", { ...WEEK, filter })).json().metrics.visitors.value;
  expect(await visitors("pathname:eq:/pricing")).toBe(2);
  expect(await visitors("prop.plan:eq:pro")).toBe(1);
  expect(await visitors("channel:eq:organicSearch")).toBe(1);
  expect(await visitors(["country:eq:de", "pathname:contains:doc"])).toBe(1);
  expect(await visitors("pathname:neq:/")).toBe(2);
  const visits = (await stats("overview", { ...WEEK, filter: "pathname:eq:/signup" })).json();
  expect(visits.metrics.visits.value).toBe(1);
});

it("overview: binds filter values: SQL in a value matches nothing; unknown fields are 400", async () => {
  await seedWeek();
  const evil = await stats("overview", { ...WEEK, filter: "pathname:eq:/' OR '1'='1" });
  expect(evil.json().metrics.visitors.value).toBe(0);
  const like = await stats("overview", { ...WEEK, filter: "pathname:contains:%" });
  expect(like.json().metrics.visitors.value).toBe(0);
  for (const filter of ["password_hash:eq:x", "prop.a;drop:eq:x"]) {
    expect((await stats("overview", { ...WEEK, filter })).statusCode).toBe(400);
  }
  const tooFine = await stats("timeseries", {
    ...WEEK,
    from: "2026-01-01T00:00:00Z",
    interval: "hour",
  });
  expect(tooFine.statusCode).toBe(400);
});

it("overview: 404 for another tenant and for an environment of another project", async () => {
  const url = `/projects/${target.projectId}/stats/overview?from=${WEEK.from}&to=${WEEK.to}`;
  const foreign = await call(t, "GET", url, tenants.cookies.ownerB);
  expect(foreign.statusCode).toBe(404);
  const env = `${url}&environmentId=00000000-0000-4000-8000-000000000000`;
  expect((await call(t, "GET", env, tenants.cookies.viewerA)).statusCode).toBe(404);
});
