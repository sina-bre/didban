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

const memberUrl = () => `/organizations/${tenants.ids.orgA}/members/${tenants.ids.memberA}`;
const projectMemberUrl = () => `/projects/${tenants.ids.projectA}/members/${tenants.ids.memberA}`;

describe("403 only for resources the caller can see (spec §11)", () => {
  it("a viewer gets 403 on member management for their project", async () => {
    const res = await call(t, "PUT", projectMemberUrl(), tenants.cookies.viewerA, {
      role: "viewer",
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("an org admin assigns project access but cannot change org roles", async () => {
    const { adminA, ownerA } = tenants.cookies;
    expect(await statusOf(t, "PUT", projectMemberUrl(), adminA, { role: "viewer" })).toBe(204);
    expect(await statusOf(t, "PATCH", memberUrl(), adminA, { role: "admin" })).toBe(403);
    expect(await statusOf(t, "PATCH", memberUrl(), ownerA, { role: "admin" })).toBe(204);
  });

  it("the owner removes a member over HTTP; the last owner rule answers 409", async () => {
    const { ownerA } = tenants.cookies;
    expect(await statusOf(t, "DELETE", memberUrl(), ownerA)).toBe(204);
    const self = `/organizations/${tenants.ids.orgA}/members/${tenants.ids.ownerA}`;
    expect(await statusOf(t, "PATCH", self, ownerA, { role: "member" })).toBe(409);
  });

  it("rejects an invalid body with 400 after the permission check passed", async () => {
    const status = await statusOf(t, "PATCH", memberUrl(), tenants.cookies.ownerA, {
      role: "superuser",
    });
    expect(status).toBe(400);
  });
});
