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

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

/** Every route that touches one of A's resources, as [method, url, body]. */
function routesOfA(): [string, string, object][] {
  const { orgA, memberA, projectA } = tenants.ids;
  return [
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

  it("malformed IDs are a plain 404, never a 500", async () => {
    const { ownerA } = tenants.cookies;
    const notUuid = `/organizations/${tenants.ids.orgA}/members/not-a-uuid`;
    expect(await statusOf(t, "DELETE", notUuid, ownerA)).toBe(404);
    const injected = "/projects/1'%20OR%201=1/members/x";
    expect(await statusOf(t, "PUT", injected, ownerA, { role: "viewer" })).toBe(404);
  });
});
