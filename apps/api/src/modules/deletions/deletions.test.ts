import { MAX_OPEN_DELETIONS } from "@didban/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { anonymousVisitorId } from "../../domain/visitor-id.js";
import { resetDb } from "../../test-support/reset-db.js";
import { seedVisit } from "../../test-support/seed-stats.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";
import { JobRunner } from "../jobs/job-runner.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let url: string;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  url = `/projects/${tenants.ids.projectA}/deletions`;
});
afterEach(() => t.close());

const counts = async () => {
  const [row] = await t.sql<{ events: number; visits: number }[]>`
    SELECT (SELECT count(*)::int FROM events) AS events, (SELECT count(*)::int FROM visits) AS visits`;
  return row;
};

it("deletions: managers queue them (audited, visitor kept as a hash), viewers and bad input cannot", async () => {
  const { ownerA, viewerA } = tenants.cookies;
  expect((await call(t, "POST", url, viewerA, { kind: "user", userId: "u-1" })).statusCode).toBe(
    403,
  );
  expect((await call(t, "GET", url, viewerA)).statusCode).toBe(403);
  const invalid = [
    { kind: "range", from: "2026-10-02T00:00:00Z", to: "2026-10-01T00:00:00Z" },
    { kind: "range", from: "yesterday", to: "2026-10-01T00:00:00Z" },
    { kind: "visitor", anonymousId: "" },
    { kind: "user", userId: "x".repeat(129) },
    { kind: "everything" },
  ];
  for (const body of invalid)
    expect((await call(t, "POST", url, ownerA, body)).statusCode).toBe(400);
  const created = await call(t, "POST", url, ownerA, { kind: "visitor", anonymousId: "aid-1" });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toMatchObject({ kind: "visitor", status: "pending", userId: null });
  expect(JSON.stringify(created.json())).not.toContain("aid-1");
  const [row] = await t.sql`SELECT visitor_id FROM data_deletions`;
  expect(row?.visitorId).toEqual(anonymousVisitorId(tenants.ids.projectA, "aid-1"));
  const [audit] =
    await t.sql`SELECT action, details FROM audit_logs WHERE target_type = 'data_deletion'`;
  expect(audit).toEqual({ action: "data_deletion.requested", details: { kind: "visitor" } });
  expect((await call(t, "GET", url, ownerA)).json().deletions).toHaveLength(1);
});

it("deletions: at most 10 open per project", async () => {
  for (let i = 0; i < MAX_OPEN_DELETIONS; i += 1) {
    await call(t, "POST", url, tenants.cookies.adminA, { kind: "user", userId: `u-${i}` });
  }
  const over = await call(t, "POST", url, tenants.cookies.adminA, { kind: "user", userId: "u-x" });
  expect([over.statusCode, over.json().error.code]).toEqual([409, "DELETION_LIMIT_REACHED"]);
});

it("deletions: the job removes exactly the user's events and visits, of project A only", async () => {
  const { projectA, projectB } = tenants.ids;
  const env = async (projectId: string) =>
    (
      await t.sql<{ id: string }[]>`
      INSERT INTO environments (project_id, name) VALUES (${projectId}, 'production') RETURNING id`
    )[0]?.id ?? "";
  const a = { projectId: projectA, environmentId: await env(projectA) };
  const b = { projectId: projectB, environmentId: await env(projectB) };
  const visit = { pages: ["/", "/pricing"], tracks: ["signup"] };
  const mine = await seedVisit(t.sql, a, { ...visit, visitor: 1, at: "2026-10-05T23:58:00Z" });
  await seedVisit(t.sql, a, { ...visit, visitor: 2, at: "2026-10-06T09:00:00Z" });
  const theirs = await seedVisit(t.sql, b, { ...visit, visitor: 1, at: "2026-10-06T09:00:00Z" });
  // identify comes with the last event: the page views before it go with the visit.
  for (const id of [mine, theirs]) {
    await t.sql`UPDATE events SET user_id = 'u-1' WHERE visit_id = ${id} AND type = 2`;
  }
  const created = await call(t, "POST", url, tenants.cookies.ownerA, {
    kind: "user",
    userId: "u-1",
  });
  await t.app.get(JobRunner).tick();
  expect(await counts()).toEqual({ events: 6, visits: 2 });
  const [left] = await t.sql`SELECT count(*)::int AS n FROM events WHERE visit_id = ${mine}`;
  expect(left?.n).toBe(0);
  const listed = (await call(t, "GET", url, tenants.cookies.ownerA)).json().deletions;
  expect(listed[0]).toMatchObject({
    id: created.json().id,
    status: "done",
    eventsDeleted: 3,
    visitsDeleted: 1,
  });
  expect(listed[0].finishedAt).not.toBeNull();
});
