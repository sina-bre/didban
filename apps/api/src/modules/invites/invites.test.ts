import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants, statusOf } from "../../test-support/tenant-fixture.js";
import { ORIGIN, startTestApp } from "../../test-support/test-app.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

const invitesUrl = () => `/organizations/${tenants.ids.orgA}/invites`;
const invite = (cookie: string, email: string, role = "member") =>
  call(t, "POST", invitesUrl(), cookie, { email, role });

describe("creating invites (spec §11)", () => {
  it("returns a one-time link with the token in the fragment and stores only its hash", async () => {
    const res = await invite(tenants.cookies.ownerA, " New@Helium.test ", "admin");
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      email: "new@helium.test",
      role: "admin",
      status: "pending",
    });
    const { acceptUrl } = res.json();
    expect(acceptUrl).toMatch(new RegExp(`^${ORIGIN}/accept-invite#[A-Za-z0-9_-]{43}$`));
    const [row] = await t.sql`SELECT row_to_json(i)::text AS json FROM invites i`;
    expect(row?.json).not.toContain(acceptUrl.split("#")[1]);
    const list = await call(t, "GET", invitesUrl(), tenants.cookies.adminA);
    expect(JSON.stringify(list.json())).not.toContain("accept-invite");
  });

  it("admins invite members only; members and other orgs cannot invite", async () => {
    const { adminA, memberA, ownerB } = tenants.cookies;
    expect((await invite(adminA, "x@helium.test")).statusCode).toBe(201);
    expect((await invite(adminA, "y@helium.test", "admin")).statusCode).toBe(403);
    expect((await invite(adminA, "y@helium.test", "owner")).statusCode).toBe(403);
    expect((await invite(memberA, "y@helium.test")).statusCode).toBe(403);
    expect((await invite(ownerB, "y@helium.test")).statusCode).toBe(404);
  });

  it("refuses current members and replaces an open invite for the same email", async () => {
    const { ownerA } = tenants.cookies;
    expect((await invite(ownerA, "m@helium.test")).statusCode).toBe(409);
    await invite(ownerA, "new@helium.test");
    await invite(ownerA, "new@helium.test", "admin");
    const list = (await call(t, "GET", invitesUrl(), ownerA)).json().invites;
    expect(list.map((i: { status: string; role: string }) => [i.status, i.role])).toEqual([
      ["pending", "admin"],
      ["revoked", "member"],
    ]);
  });
});

describe("revoking invites (spec §11)", () => {
  it("is idempotent, and admins cannot revoke owner/admin invites", async () => {
    const { ownerA, adminA } = tenants.cookies;
    const forAdmin = (await invite(ownerA, "boss@helium.test", "admin")).json();
    expect(await statusOf(t, "DELETE", `${invitesUrl()}/${forAdmin.id}`, adminA)).toBe(403);
    expect(await statusOf(t, "DELETE", `${invitesUrl()}/${forAdmin.id}`, ownerA)).toBe(204);
    expect(await statusOf(t, "DELETE", `${invitesUrl()}/${forAdmin.id}`, ownerA)).toBe(204);
    const [n] =
      await t.sql`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'invite.revoked'`;
    expect(n?.n).toBe(1);
  });
});

describe("platform admin owner invites (spec §11)", () => {
  it("only platform admins, only live organizations, without becoming a member", async () => {
    const url = `/admin/organizations/${tenants.ids.orgA}/invites`;
    const body = { email: "second-owner@helium.test" };
    expect(await statusOf(t, "POST", url, tenants.cookies.ownerA, body)).toBe(403);
    await t.sql`UPDATE users SET is_platform_admin = true WHERE id = ${tenants.ids.ownerB}`;
    const res = await call(t, "POST", url, tenants.cookies.ownerB, body);
    expect(res.statusCode).toBe(201);
    expect(res.json().role).toBe("owner");
    expect(await statusOf(t, "GET", invitesUrl(), tenants.cookies.ownerB)).toBe(404);
    await t.sql`UPDATE organizations SET suspended_at = now() WHERE id = ${tenants.ids.orgA}`;
    expect(await statusOf(t, "POST", url, tenants.cookies.ownerB, { email: "z@h.test" })).toBe(404);
  });
});
