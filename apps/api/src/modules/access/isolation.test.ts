import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import {
  bodyWithoutRequestId,
  call,
  seedTwoTenants,
  statusOf,
} from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
let envA: string;
let keyA: string;
let tokenA: string;
let routeA: string;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
  const envs = `/projects/${tenants.ids.projectA}/environments`;
  envA = (await call(t, "POST", envs, tenants.cookies.ownerA, { name: "production" })).json().id;
  const key = await call(t, "POST", `${envs}/${envA}/keys`, tenants.cookies.ownerA, {
    kind: "write_server",
  });
  ({ id: keyA, token: tokenA } = key.json());
  const route = await call(
    t,
    "POST",
    `/projects/${tenants.ids.projectA}/routes`,
    tenants.cookies.ownerA,
    {
      pattern: "/products/:id",
    },
  );
  routeA = route.json().id;
});
afterEach(() => t.close());

const STATS_RANGE = "from=2026-10-01T00:00:00Z&to=2026-10-08T00:00:00Z";

/** Every route that touches one of A's resources, as [method, url, body]. */
function routesOfA(): [string, string, object][] {
  const { orgA, memberA, projectA } = tenants.ids;
  const project = `/projects/${projectA}`;
  return [
    ["GET", `/organizations/${orgA}/audit-log`, {}],
    ["POST", `/organizations/${orgA}/users`, { email: "x@evil.test", role: "owner" }],
    ["POST", `/organizations/${orgA}/members/${memberA}/password-reset`, {}],
    ["GET", `/organizations/${orgA}/projects`, {}],
    ["POST", `/organizations/${orgA}/projects`, { name: "Stolen" }],
    ["PATCH", `/organizations/${orgA}/projects/${projectA}`, { archived: true }],
    ["GET", project, {}],
    ["PATCH", project, { retentionDays: 7 }],
    ["GET", `${project}/environments`, {}],
    ["POST", `${project}/environments`, { name: "staging" }],
    ["PATCH", `${project}/environments/${envA}`, { trackLocalhost: true }],
    ["GET", `${project}/keys`, {}],
    ["POST", `${project}/environments/${envA}/keys`, { kind: "write_server" }],
    ["DELETE", `${project}/keys/${keyA}`, {}],
    ["GET", `${project}/routes`, {}],
    ["POST", `${project}/routes`, { pattern: "/stolen" }],
    ["POST", `${project}/routes/preview`, { paths: ["/products/1"] }],
    ["PATCH", `${project}/routes/${routeA}`, { position: 1 }],
    ["DELETE", `${project}/routes/${routeA}`, {}],
    ["GET", `${project}/stats/overview?${STATS_RANGE}`, {}],
    ["GET", `${project}/stats/timeseries?${STATS_RANGE}`, {}],
    ...["pages", "sources", "geo", "devices", "events", "events/signup/properties"].map(
      (report): [string, string, object] => [
        "GET",
        `${project}/stats/${report}?${STATS_RANGE}`,
        {},
      ],
    ),
    ["GET", `${project}/stats/realtime`, {}],
    ["GET", `${project}/stats/data-health`, {}],
    ["GET", `${project}/stats/export.csv?report=pages&${STATS_RANGE}`, {}],
    ["GET", `${project}/stats/pages/detail?${STATS_RANGE}&hostname=a.example&route=/`, {}],
    ["PATCH", `/organizations/${orgA}/members/${memberA}`, { role: "admin" }],
    ["DELETE", `/organizations/${orgA}/members/${memberA}`, {}],
    ["PUT", `/projects/${projectA}/members/${memberA}`, { role: "viewer" }],
    ["DELETE", `/projects/${projectA}/members/${memberA}`, {}],
  ];
}

async function expectHidden(cookie: string) {
  const missing = await call(
    t,
    "DELETE",
    `/projects/${randomUUID()}/members/${randomUUID()}`,
    cookie,
  );
  expect(missing.statusCode).toBe(404);
  for (const [method, url, body] of routesOfA()) {
    const res = await call(t, method, url, cookie, body);
    expect([method, url, res.statusCode]).toEqual([method, url, 404]);
    expect(bodyWithoutRequestId(res.json())).toEqual(bodyWithoutRequestId(missing.json()));
  }
}

describe("tenant isolation (spec §11, §16)", () => {
  it("owner B gets 404, identical to a missing resource, on every route of A", async () => {
    await expectHidden(tenants.cookies.ownerB);
    const [members] = await t.sql`SELECT count(*)::int AS n FROM memberships`;
    expect(members?.n).toBe(5); // nothing of A changed
    const [state] = await t.sql`
      SELECT (SELECT count(*)::int FROM projects) AS projects,
             (SELECT count(*)::int FROM environments) AS envs,
             (SELECT count(revoked_at)::int FROM api_keys) AS revoked,
             (SELECT count(*)::int FROM projects WHERE archived_at IS NOT NULL) AS archived,
             (SELECT string_agg(pattern, ',') FROM route_templates) AS routes`;
    const routes = "/products/:id";
    expect(state).toEqual({ projects: 2, envs: 1, revoked: 0, archived: 0, routes });
  });

  it("a platform admin who is not a member gets 404 on A's routes", async () => {
    await t.sql`UPDATE users SET is_platform_admin = true WHERE id = ${tenants.ids.ownerB}`;
    await expectHidden(tenants.cookies.ownerB);
  });

  it("an org member without a project row gets 404 on the project", async () => {
    const url = `/projects/${tenants.ids.projectA}/members/${tenants.ids.viewerA}`;
    expect(await statusOf(t, "DELETE", url, tenants.cookies.memberA)).toBe(404);
  });

  it("a write key opens no management route (spec §11 separate boundary)", async () => {
    for (const headers of [{ "x-write-key": tokenA }, { authorization: `Bearer ${tokenA}` }]) {
      const res = await t.send({
        method: "GET",
        url: `/api/v1/projects/${tenants.ids.projectA}/keys`,
        headers,
      });
      expect(res.statusCode).toBe(401);
    }
  });
});
