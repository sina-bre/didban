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

const orgProjects = () => `/organizations/${tenants.ids.orgA}/projects`;

describe("project creation (spec §9.1, §11)", () => {
  it("an org admin creates a project with a unique slug and DB defaults", async () => {
    const res = await call(t, "POST", orgProjects(), tenants.cookies.adminA, {
      name: "HeliumPark",
      reportingTimezone: "Asia/Tehran",
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      organizationId: tenants.ids.orgA,
      slug: "heliumpark-2", // the fixture already owns "heliumpark"
      reportingTimezone: "Asia/Tehran",
      sessionTimeoutMinutes: 30,
      retentionDays: null,
      allowIdentify: false,
      piiGuard: "strip",
      urlParamAllowlist: [],
      archivedAt: null,
    });
  });

  it("refuses unknown time zones and lets only owners/admins create", async () => {
    const { adminA, viewerA, memberA } = tenants.cookies;
    expect(
      await statusOf(t, "POST", orgProjects(), adminA, { name: "X", reportingTimezone: "+03:30" }),
    ).toBe(400);
    expect(await statusOf(t, "POST", orgProjects(), viewerA, { name: "X" })).toBe(403);
    expect(await statusOf(t, "POST", orgProjects(), memberA, { name: "X" })).toBe(403);
  });
});

describe("project settings and archive (spec §9.1, §11)", () => {
  it("a viewer reads settings but cannot change them; the owner can", async () => {
    const url = `/projects/${tenants.ids.projectA}`;
    const { viewerA, ownerA } = tenants.cookies;
    expect((await call(t, "GET", url, viewerA)).json().slug).toBe("heliumpark");
    expect(await statusOf(t, "PATCH", url, viewerA, { retentionDays: 30 })).toBe(403);
    const res = await call(t, "PATCH", url, ownerA, {
      retentionDays: 30,
      urlParamAllowlist: ["q", "q", "page"],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ retentionDays: 30, urlParamAllowlist: ["q", "page"] });
    expect(await statusOf(t, "PATCH", url, ownerA, { slug: "x" })).toBe(400); // unknown key only
  });

  it("archive hides the project; restore brings it back", async () => {
    const { ownerA, viewerA } = tenants.cookies;
    const archive = `${orgProjects()}/${tenants.ids.projectA}`;
    expect(await statusOf(t, "PATCH", archive, ownerA, { archived: true })).toBe(204);
    expect(await statusOf(t, "GET", `/projects/${tenants.ids.projectA}`, viewerA)).toBe(404);
    const list = await call(t, "GET", orgProjects(), ownerA);
    expect(list.json().projects[0]).toMatchObject({ id: tenants.ids.projectA });
    expect(list.json().projects[0].archivedAt).not.toBeNull();
    expect(await statusOf(t, "PATCH", archive, ownerA, { archived: false })).toBe(204);
    expect(await statusOf(t, "GET", `/projects/${tenants.ids.projectA}`, viewerA)).toBe(200);
  });

  it("B's project cannot be archived through A's organization route", async () => {
    const url = `${orgProjects()}/${tenants.ids.projectB}`;
    expect(await statusOf(t, "PATCH", url, tenants.cookies.ownerA, { archived: true })).toBe(404);
    const [row] = await t.sql`SELECT archived_at FROM projects WHERE id = ${tenants.ids.projectB}`;
    expect(row?.archivedAt).toBeNull();
  });
});
