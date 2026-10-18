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
  await seedWeek();
});
afterEach(() => t.close());

const WEEK = { from: "2026-10-05T00:00:00Z", to: "2026-10-12T00:00:00Z" };

async function seedWeek() {
  const day = (d: number, h = 9) => `2026-10-0${d}T${String(h).padStart(2, "0")}:00:00Z`;
  await seedVisit(t.sql, target, {
    visitor: 1,
    at: day(6),
    pages: ["/", "/pricing"],
    tracks: [{ name: "signup", properties: { plan: "pro" } }, "scroll_depth"],
    channel: 1,
    browser: "Chrome",
    deviceType: 1,
    country: "DE",
  });
  await seedVisit(t.sql, target, {
    visitor: 2,
    at: day(7),
    pages: ["/pricing"],
    tracks: [
      { name: "signup", properties: { plan: "free" } },
      { name: "scroll_depth", properties: { percent: 50 } },
      { name: "engaged_time", properties: { seconds: 30 } },
    ],
    utmSource: "newsletter",
    channel: 4,
    browser: "Safari",
    deviceType: 2,
    country: "FR",
  });
  await seedVisit(t.sql, target, { visitor: 3, at: day(8), pages: ["/docs"], browser: "Chrome" });
  await seedServerEvent(t.sql, target, day(8, 12), "purchase_completed");
}

async function report(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...WEEK, ...params });
  const res = await call(
    t,
    "GET",
    `/projects/${target.projectId}/stats/${path}?${query}`,
    tenants.cookies.viewerA,
  );
  expect([path, res.statusCode]).toEqual([path, 200]);
  return res.json();
}
const values = (json: { rows: { value: string | null }[] }) => json.rows.map((r) => r.value);

it("pages: top by (hostname, route), entry and exit pages, limit + truncated", async () => {
  const top = await report("pages");
  expect(top.rows[0]).toEqual({
    hostname: "heliumpark.example",
    route: "/pricing",
    visitors: 2,
    pageviews: 2,
  });
  const one = await report("pages", { limit: "1" });
  expect([one.rows.length, one.meta.truncated]).toEqual([1, true]);
  expect(values(await report("pages", { view: "entry" }))).toEqual(["/", "/docs", "/pricing"]);
  const exits = await report("pages", { view: "exit" });
  expect(exits.rows[0]).toMatchObject({ value: "/pricing", visitors: 2, visits: 2, bounceRate: 0 });
});

it("pages: discovered lists pages_seen first seen in the range, newest first", async () => {
  await t.sql`
    INSERT INTO pages_seen (project_id, environment_id, hostname, route, first_seen_at, last_seen_at)
    VALUES (${target.projectId}, ${target.environmentId}, 'heliumpark.example', '/old', '2026-09-01T00:00:00Z', '2026-10-06T00:00:00Z'),
           (${target.projectId}, ${target.environmentId}, 'heliumpark.example', '/new', '2026-10-07T00:00:00Z', '2026-10-07T00:00:00Z')`;
  const rows = (await report("pages", { view: "discovered" })).rows;
  expect(rows).toEqual([
    expect.objectContaining({ route: "/new", firstSeenAt: "2026-10-07T00:00:00.000Z" }),
  ]);
});

it("sources: first-touch channel names and UTM values, with visit metrics", async () => {
  const channels = await report("sources");
  expect(values(channels)).toEqual(["direct", "organicSearch", "email"]); // ties: by stored code
  expect(values(await report("sources", { filter: "pathname:eq:/docs" }))).toEqual(["direct"]);
  const utm = await report("sources", { by: "utm_source" });
  expect(utm.rows).toContainEqual(expect.objectContaining({ value: "newsletter", visits: 1 }));
});

it("geo and devices: browser events by column, coded columns by name", async () => {
  expect(values(await report("geo"))).toEqual(["DE", "FR", null]);
  expect(values(await report("devices"))).toEqual(["Chrome", "Safari"]);
  const types = await report("devices", { by: "device_type" });
  expect(values(types)).toEqual(["desktop", "mobile", null]);
  const mobile = await report("geo", { filter: "device_type:eq:mobile" });
  expect(values(mobile)).toEqual(["FR"]);
});

it("events and properties: names (both sources), keys, values of one key", async () => {
  const events = await report("events");
  expect(events.rows).toContainEqual({ value: "signup", visitors: 2, pageviews: 0, events: 2 });
  expect(events.rows).toContainEqual({
    value: "purchase_completed",
    visitors: 0,
    pageviews: 0,
    events: 1,
  });
  expect(values(await report("events/signup/properties"))).toEqual(["plan"]);
  expect(values(await report("events/signup/properties", { key: "plan" }))).toEqual([
    "free",
    "pro",
  ]);
  const bad = await call(
    t,
    "GET",
    `/projects/${target.projectId}/stats/events/1bad/properties?${new URLSearchParams(WEEK)}`,
    tenants.cookies.viewerA,
  );
  expect(bad.statusCode).toBe(400);
});

it("page detail: views, scroll depth and engaged time of one page", async () => {
  const detail = await report("pages/detail", {
    hostname: "heliumpark.example",
    route: "/pricing",
  });
  expect(detail).toMatchObject({ visitors: 2, pageviews: 2, engagedSeconds: 30 });
  expect(detail.scrollDepth).toEqual([{ percent: 50, visitors: 1 }]);
  const none = await report("pages/detail", { hostname: "heliumpark.example", route: "/docs" });
  expect([none.scrollDepth, none.engagedSeconds]).toEqual([null, null]);
});
