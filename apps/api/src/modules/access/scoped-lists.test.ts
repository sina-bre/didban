import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants, statusOf } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

describe("scoped lists and IDs (spec §11)", () => {
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
