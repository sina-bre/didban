import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { startTestApp } from "../../test-support/test-app.js";

// Stage 5e reads: member lists for settings, the project audit filter, platform admin pages.
let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

const get = (url: string, cookie: string) => call(t, "GET", url, cookie);

describe("member lists", () => {
  it("org members: owners and admins read emails and roles; members get 403", async () => {
    const url = `/organizations/${tenants.ids.orgA}/members`;
    const res = await get(url, tenants.cookies.adminA);
    expect(res.statusCode).toBe(200);
    const members = res.json().members as { email: string; role: string }[];
    expect(members.map((m) => `${m.email}:${m.role}`)).toEqual([
      "a@helium.test:owner",
      "admin@helium.test:admin",
      "m@helium.test:member",
      "v@helium.test:member",
    ]);
    expect(Object.keys(res.json().members[0]).sort()).toEqual(
      ["email", "joinedAt", "mustChangePassword", "role", "userId"].sort(),
    );
    expect((await get(url, tenants.cookies.memberA)).statusCode).toBe(403);
  });

  it("project members: assigned roles plus org members that could be assigned", async () => {
    const url = `/projects/${tenants.ids.projectA}/members`;
    const res = await get(url, tenants.cookies.ownerA);
    expect(res.json()).toEqual({
      members: [{ userId: tenants.ids.viewerA, email: "v@helium.test", role: "viewer" }],
      candidates: [{ userId: tenants.ids.memberA, email: "m@helium.test" }],
    });
    expect((await get(url, tenants.cookies.viewerA)).statusCode).toBe(403);
  });
});

describe("audit log of one project", () => {
  it("`projectId` keeps only that project's entries", async () => {
    const { orgA, projectA } = tenants.ids;
    await call(t, "POST", `/projects/${projectA}/shares`, tenants.cookies.ownerA, { label: "x" });
    await call(t, "POST", `/organizations/${orgA}/projects`, tenants.cookies.ownerA, { name: "B" });
    const all = (await get(`/organizations/${orgA}/audit-log`, tenants.cookies.ownerA)).json();
    const one = await get(
      `/organizations/${orgA}/audit-log?projectId=${projectA}`,
      tenants.cookies.ownerA,
    );
    expect(all.entries.length).toBe(2);
    expect(one.json().entries.map((e: { action: string }) => e.action)).toEqual([
      "share_link.created",
    ]);
  });
});

describe("platform admin pages", () => {
  const urls = ["/admin/organizations", "/admin/users", "/admin/instance"];

  it("are 403 for everyone else, owners included", async () => {
    for (const url of urls) {
      expect([url, (await get(url, tenants.cookies.ownerA)).statusCode]).toEqual([url, 403]);
    }
  });

  it("show counts, never project data", async () => {
    await t.sql`UPDATE users SET is_platform_admin = true WHERE id = ${tenants.ids.ownerB}`;
    const cookie = tenants.cookies.ownerB;
    const orgs = (await get("/admin/organizations", cookie)).json().organizations;
    expect(
      orgs.map((o: { slug: string; members: number; projects: number }) => [
        o.slug,
        o.members,
        o.projects,
      ]),
    ).toEqual([
      ["another-website", 1, 1],
      ["heliumpark", 4, 1],
    ]);
    const users = (await get("/admin/users", cookie)).json().users;
    expect(users).toHaveLength(5);
    expect(Object.keys(users[0]).sort()).toEqual(
      ["createdAt", "email", "id", "isPlatformAdmin", "mustChangePassword", "organizations"].sort(),
    );
    const instance = (await get("/admin/instance", cookie)).json();
    expect(instance.counts).toEqual({ organizations: 2, users: 5, projects: 2, eventsToday: 0 });
    expect(instance.postgres).toMatch(/^\d+/);
  });
});
