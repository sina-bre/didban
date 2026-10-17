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

describe("platform admin and suspension (spec §11)", () => {
  it("non-admins get 403 on admin routes; an admin creates and suspends organizations", async () => {
    const create = (cookie: string) =>
      call(t, "POST", "/admin/organizations", cookie, { name: "Gamma" });
    expect((await create(tenants.cookies.ownerA)).statusCode).toBe(403);
    await t.sql`UPDATE users SET is_platform_admin = true WHERE id = ${tenants.ids.ownerB}`;
    const created = await create(tenants.cookies.ownerB);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ slug: "gamma" });
    const suspend = `/admin/organizations/${tenants.ids.orgA}`;
    expect(await statusOf(t, "PATCH", suspend, tenants.cookies.ownerB, { suspended: true })).toBe(
      204,
    );
  });

  it("a suspended organization disappears for its own members", async () => {
    const { orgA, projectA, memberA } = tenants.ids;
    const { ownerA } = tenants.cookies;
    await t.sql`UPDATE organizations SET suspended_at = now() WHERE id = ${orgA}`;
    expect((await call(t, "GET", "/organizations", ownerA)).json().organizations).toEqual([]);
    expect((await call(t, "GET", "/projects", ownerA)).json().projects).toEqual([]);
    const assign = `/projects/${projectA}/members/${memberA}`;
    expect(await statusOf(t, "PUT", assign, ownerA, { role: "viewer" })).toBe(404);
  });
});
