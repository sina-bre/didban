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
let inviteA: string;

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
  const invites = `/organizations/${tenants.ids.orgA}/invites`;
  const invite = await call(t, "POST", invites, tenants.cookies.ownerA, {
    email: "invitee@helium.test",
    role: "member",
  });
  inviteA = invite.json().id;
});
afterEach(() => t.close());

/** Every route that touches one of A's resources, as [method, url, body]. */
function routesOfA(): [string, string, object][] {
  const { orgA, memberA, projectA } = tenants.ids;
  const project = `/projects/${projectA}`;
  return [
    ["GET", `/organizations/${orgA}/audit-log`, {}],
    ["GET", `/organizations/${orgA}/invites`, {}],
    ["POST", `/organizations/${orgA}/invites`, { email: "x@evil.test", role: "owner" }],
    ["DELETE", `/organizations/${orgA}/invites/${inviteA}`, {}],
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
             (SELECT count(*)::int FROM projects WHERE archived_at IS NOT NULL) AS archived`;
    expect(state).toEqual({ projects: 2, envs: 1, revoked: 0, archived: 0 });
  });

  it("a platform admin who is not a member gets 404 on A's routes", async () => {
    await t.sql`UPDATE users SET is_platform_admin = true WHERE id = ${tenants.ids.ownerB}`;
    await expectHidden(tenants.cookies.ownerB);
  });

  it("an org member without a project row gets 404 on the project", async () => {
    const url = `/projects/${tenants.ids.projectA}/members/${tenants.ids.viewerA}`;
    expect(await statusOf(t, "DELETE", url, tenants.cookies.memberA)).toBe(404);
  });

  it("lists only show the caller's own organizations and projects", async () => {
    const orgs = await call(t, "GET", "/organizations", tenants.cookies.ownerB);
    expect(orgs.json().organizations).toEqual([
      { id: tenants.ids.orgB, name: "another-website", slug: "another-website", role: "owner" },
    ]);
    const projects = await call(t, "GET", "/projects", tenants.cookies.ownerB);
    expect(projects.json().projects.map((p: { id: string }) => p.id)).toEqual([
      tenants.ids.projectB,
    ]);
    const forMember = await call(t, "GET", "/projects", tenants.cookies.memberA);
    expect(forMember.json().projects).toEqual([]);
    const forViewer = await call(t, "GET", "/projects", tenants.cookies.viewerA);
    expect(forViewer.json().projects[0]).toMatchObject({
      id: tenants.ids.projectA,
      role: "viewer",
    });
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

  it("malformed IDs are a plain 404, never a 500", async () => {
    const { ownerA } = tenants.cookies;
    const notUuid = `/organizations/${tenants.ids.orgA}/members/not-a-uuid`;
    expect(await statusOf(t, "DELETE", notUuid, ownerA)).toBe(404);
    const injected = "/projects/1'%20OR%201=1/members/x";
    expect(await statusOf(t, "PUT", injected, ownerA, { role: "viewer" })).toBe(404);
  });
});
