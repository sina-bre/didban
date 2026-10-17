import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetPasswordCommand } from "../../cli/reset-password-command.js";
import { resetDb } from "../../test-support/reset-db.js";
import { call, seedTwoTenants, statusOf } from "../../test-support/tenant-fixture.js";
import { sessionFrom, startTestApp } from "../../test-support/test-app.js";
import { checkPassword } from "../auth/password-policy.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
const STRONG = "a long and unusual passphrase";

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

const usersUrl = () => `/organizations/${tenants.ids.orgA}/users`;
const create = (cookie: string, email: string, role = "member") =>
  call(t, "POST", usersUrl(), cookie, { email, role });
const login = (email: string, password: string) => t.post("/auth/login", { email, password });

describe("creating users (ADR 0024)", () => {
  it("returns a strong one-time password; first login must change it", async () => {
    const res = await create(tenants.cookies.ownerA, "New@Helium.test", "admin");
    expect(res.statusCode).toBe(201);
    const { temporaryPassword, email } = res.json();
    expect(email).toBe("new@helium.test");
    expect(temporaryPassword).toMatch(/^([A-Za-z2-9]{5}-){3}[A-Za-z2-9]{5}$/);
    expect(checkPassword(temporaryPassword)).toBeNull();
    const cookie = sessionFrom(await login(email, temporaryPassword));
    expect((await t.get("/auth/me", { cookie })).json().user.mustChangePassword).toBe(true);
    const blocked = await call(t, "GET", "/projects", cookie);
    expect([blocked.statusCode, blocked.json().error.code]).toEqual([
      403,
      "PASSWORD_CHANGE_REQUIRED",
    ]);
    const change = (newPassword: string) =>
      call(t, "POST", "/auth/password", cookie, {
        currentPassword: temporaryPassword,
        newPassword,
      });
    expect((await change(temporaryPassword)).json().error.code).toBe("PASSWORD_UNCHANGED");
    expect((await change(STRONG)).statusCode).toBe(204);
    expect(await statusOf(t, "GET", "/projects", cookie)).toBe(200);
    const [row] = await t.sql`SELECT row_to_json(a)::text AS json FROM audit_logs a
                              WHERE action = 'user.created'`;
    expect(row?.json).not.toContain(temporaryPassword);
  });

  it("admins create members only; members and other orgs cannot; emails are unique", async () => {
    const { ownerA, adminA, memberA, ownerB } = tenants.cookies;
    expect((await create(adminA, "x@helium.test")).statusCode).toBe(201);
    expect((await create(adminA, "y@helium.test", "admin")).statusCode).toBe(403);
    expect((await create(memberA, "y@helium.test")).statusCode).toBe(403);
    expect((await create(ownerB, "y@helium.test")).statusCode).toBe(404);
    const taken = await create(ownerA, "b@another.test"); // owner of org B
    expect([taken.statusCode, taken.json().error.code]).toEqual([409, "EMAIL_TAKEN"]);
  });
});

describe("password reset by the owner (ADR 0024)", () => {
  const resetUrl = (userId: string) =>
    `/organizations/${tenants.ids.orgA}/members/${userId}/password-reset`;

  it("issues a new temporary password and revokes the user's sessions", async () => {
    const { memberA, ownerA } = tenants.cookies;
    const res = await call(t, "POST", resetUrl(tenants.ids.memberA), ownerA);
    expect(res.statusCode).toBe(200);
    expect(await statusOf(t, "GET", "/projects", memberA)).toBe(401);
    const cookie = sessionFrom(await login("m@helium.test", res.json().temporaryPassword));
    expect((await t.get("/auth/me", { cookie })).json().user.mustChangePassword).toBe(true);
  });

  it("only owners; not themself; not accounts that live in other organizations", async () => {
    const { adminA, ownerA, ownerB } = tenants.cookies;
    expect(await statusOf(t, "POST", resetUrl(tenants.ids.memberA), adminA)).toBe(403);
    expect(await statusOf(t, "POST", resetUrl(tenants.ids.memberA), ownerB)).toBe(404);
    expect(await statusOf(t, "POST", resetUrl(tenants.ids.ownerA), ownerA)).toBe(409);
    await t.sql`INSERT INTO memberships (user_id, organization_id, role)
                VALUES (${tenants.ids.memberA}, ${tenants.ids.orgB}, 'member')`;
    const res = await call(t, "POST", resetUrl(tenants.ids.memberA), ownerA);
    expect([res.statusCode, res.json().error.code]).toEqual([403, "RESET_NEEDS_OPERATOR"]);
  });
});

describe("pnpm cli reset-password (spec §11 operator reset)", () => {
  it("resets any account, also members of several organizations", async () => {
    await t.sql`INSERT INTO memberships (user_id, organization_id, role)
                VALUES (${tenants.ids.memberA}, ${tenants.ids.orgB}, 'member')`;
    const log = console.log;
    const lines: string[] = [];
    console.log = (line: string) => lines.push(line);
    try {
      expect(await resetPasswordCommand(t.sql, ["m@helium.test"])).toBe(0);
    } finally {
      console.log = log;
    }
    expect((await login("m@helium.test", lines[1] ?? "")).statusCode).toBe(200);
    const [row] = await t.sql`SELECT actor_user_id, organization_id FROM audit_logs
                              WHERE action = 'user.password_reset'`;
    expect(row).toEqual({ actorUserId: null, organizationId: null });
  });
});

describe("platform admin creates an owner (spec §11)", () => {
  it("only platform admins, only live organizations, without becoming a member", async () => {
    const url = `/admin/organizations/${tenants.ids.orgA}/owners`;
    const body = { email: "second-owner@helium.test" };
    expect(await statusOf(t, "POST", url, tenants.cookies.ownerA, body)).toBe(403);
    await t.sql`UPDATE users SET is_platform_admin = true WHERE id = ${tenants.ids.ownerB}`;
    const res = await call(t, "POST", url, tenants.cookies.ownerB, body);
    expect([res.statusCode, res.json().role]).toEqual([201, "owner"]);
    expect(
      await statusOf(t, "GET", `/projects/${tenants.ids.projectA}`, tenants.cookies.ownerB),
    ).toBe(404);
    await t.sql`UPDATE organizations SET suspended_at = now() WHERE id = ${tenants.ids.orgA}`;
    expect(await statusOf(t, "POST", url, tenants.cookies.ownerB, { email: "z@h.test" })).toBe(404);
  });
});
