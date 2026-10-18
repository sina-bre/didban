import { afterEach, beforeEach, expect, it } from "vitest";
import { page, sendEvents } from "../../test-support/ingest-events.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedIngestTarget } from "../../test-support/seed-ingest.js";
import { seedMember, seedSession } from "../../test-support/seed-org.js";
import { seedVisit } from "../../test-support/seed-stats.js";
import { call } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

// Realtime, Data Health, CSV export and the response cache over HTTP, on a real ingest target.
let t: Awaited<ReturnType<typeof startTestApp>>;
let target: Awaited<ReturnType<typeof seedIngestTarget>>;
let cookie: string;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  target = await seedIngestTarget(t.sql);
  cookie = await seedSession(
    t.sql,
    await seedMember(t.sql, target.organizationId, "o@h.test", "owner"),
  );
});
afterEach(() => t.close());

const get = (path: string) => call(t, "GET", `/projects/${target.projectId}/stats/${path}`, cookie);
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

it("realtime: active visitors (5 min), pages, per-minute views, sources, recent events", async () => {
  await seedVisit(t.sql, target, {
    visitor: 1,
    at: ago(2),
    pages: ["/", "/pricing"],
    tracks: ["signup"],
  });
  await seedVisit(t.sql, target, { visitor: 2, at: ago(20), pages: ["/docs"], channel: 1 });
  const res = await get("realtime");
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.activeVisitors).toBe(1);
  expect(body.activePages.map((p: { route: string }) => p.route).sort()).toEqual(["/", "/pricing"]);
  expect(body.pageviewsPerMinute).toHaveLength(31);
  expect(
    body.pageviewsPerMinute.reduce((n: number, p: { pageviews: number }) => n + p.pageviews, 0),
  ).toBe(3);
  expect(body.sources).toEqual([
    { value: "direct", visits: 1 },
    { value: "organicSearch", visits: 1 },
  ]);
  expect(body.recentEvents[0]).toEqual({
    at: expect.any(String),
    type: "track",
    name: "signup",
    pathname: "/pricing",
    country: null,
  });
  expect(Object.keys(body.recentEvents[0])).not.toContain("visitorId");
});

it("data health: last event, hourly events, rejections, origins, pages_seen cap, debugger", async () => {
  await sendEvents(t, target.browserKey, [page("/")]);
  const foreign = await t.send({
    method: "POST",
    url: "/api/v1/ingest/batch",
    payload: JSON.stringify({
      schemaVersion: 1,
      sentAt: new Date().toISOString(),
      writeKey: target.browserKey,
      events: [],
    }),
    headers: { "content-type": "text/plain", origin: "https://evil.example" },
  });
  expect(foreign.statusCode).toBe(403);
  await t.sql`
    INSERT INTO ingestion_diagnostics (project_id, environment_id, hour, code, count)
    VALUES (${target.projectId}, ${target.environmentId}, date_trunc('hour', now(), 'UTC'), 'ORIGIN_NOT_ALLOWED', 4)`;
  await t.sql`
    INSERT INTO ingestion_rejected_origins (project_id, environment_id, day, origin, count, last_seen_at)
    VALUES (${target.projectId}, ${target.environmentId}, (now() AT TIME ZONE 'UTC')::date, 'https://evil.example', 4, now())`;
  const body = (await get("data-health")).json();
  expect(body.lastEventAt).not.toBeNull();
  expect(body.eventsPerHour.length).toBeGreaterThanOrEqual(168);
  expect(body.eventsPerHour.reduce((n: number, h: { events: number }) => n + h.events, 0)).toBe(1);
  expect(body.rejections).toEqual([{ code: "ORIGIN_NOT_ALLOWED", count: 4 }]);
  expect(body.rejectedOrigins[0]).toMatchObject({ origin: "https://evil.example", count: 4 });
  expect(body.pagesSeen).toEqual({ count: 1, cap: 10_000, overflowing: false });
  expect(body.recentRejections).toEqual([
    { at: expect.any(String), code: "ORIGIN_NOT_ALLOWED", origin: "https://evil.example" },
  ]);
});

it("export.csv: a breakdown as an attachment, the report's own parameters checked", async () => {
  await seedVisit(t.sql, target, {
    visitor: 1,
    at: ago(30),
    pages: ["/", "=cmd"],
    tracks: [{ name: "signup", properties: { plan: "pro" } }],
  });
  const range = `from=${ago(60).slice(0, 19)}Z&to=${ago(-1).slice(0, 19)}Z`;
  const res = await get(`export.csv?report=pages&${range}`);
  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
  expect(res.headers["content-disposition"]).toMatch(
    /^attachment; filename="didban-pages-[0-9-]+-[0-9-]+\.csv"$/,
  );
  const lines = res.body
    .slice(1) /* BOM */
    .trim()
    .split("\r\n");
  expect(lines[0]).toBe("hostname,route,visitors,pageviews");
  expect(lines).toContain("heliumpark.example,'=cmd,1,1");
  const props = await get(`export.csv?report=properties&event=signup&key=plan&${range}`);
  expect(props.body).toContain("pro,1,0,1");
  for (const bad of ["report=nope", "report=properties", "report=sources&by=password"]) {
    expect((await get(`export.csv?${bad}&${range}`)).statusCode).toBe(400);
  }
});

it("cache: the same query within 15 s is answered from memory; another query is not", async () => {
  await seedVisit(t.sql, target, { visitor: 1, at: ago(30), pages: ["/"] });
  const range = `from=${ago(60).slice(0, 19)}Z&to=${ago(-1).slice(0, 19)}Z`;
  const visitors = async (extra = "") =>
    (await get(`overview?${range}${extra}`)).json().metrics.visitors.value;
  expect(await visitors()).toBe(1);
  const active = async () => (await get("realtime")).json().activeVisitors;
  expect(await active()).toBe(0);
  await seedVisit(t.sql, target, { visitor: 2, at: ago(1), pages: ["/"] });
  expect(await visitors()).toBe(1);
  expect(await active()).toBe(1); // realtime is never cached
  expect(await visitors("&compare=previous_period")).toBe(2);
});
