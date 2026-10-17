import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test-support/reset-db.js";
import { bodyWithoutRequestId, call, seedTwoTenants } from "../../test-support/tenant-fixture.js";
import { sessionFrom, startTestApp } from "../../test-support/test-app.js";
import { createOwner } from "../users/create-owner.js";

let t: Awaited<ReturnType<typeof startTestApp>>;
let tenants: Awaited<ReturnType<typeof seedTwoTenants>>;
const STRONG = "a long and unusual passphrase";

beforeEach(async () => {
  await resetDb();
  t = await startTestApp();
  tenants = await seedTwoTenants(t.sql);
});
afterEach(() => t.close());

async function inviteToken(email: string, role = "member"): Promise<string> {
  const url = `/organizations/${tenants.ids.orgA}/invites`;
  const res = await call(t, "POST", url, tenants.cookies.ownerA, { email, role });
  return String(res.json().acceptUrl).split("#")[1] ?? "";
}
const accept = (token: string, password: string) =>
  t.post("/auth/accept-invite", { token, password });
const preview = (token: string) => t.post("/auth/accept-invite/preview", { token });

describe("accepting an invite as a new user (spec §11)", () => {
  it("creates the account, joins with the role, signs in, and works once", async () => {
    const token = await inviteToken("new@helium.test", "admin");
    expect((await preview(token)).json()).toEqual({
      organizationName: "heliumpark",
      email: "new@helium.test",
      role: "admin",
      accountExists: false,
    });
    expect((await accept(token, "unbelievable")).json().error.code).toBe("PASSWORD_TOO_COMMON");
    const res = await accept(token, STRONG);
    expect(res.statusCode).toBe(200);
    const me = await t.get("/auth/me", { cookie: sessionFrom(res) });
    expect(me.json().user.email).toBe("new@helium.test");
    const orgs = await t.get("/organizations", { cookie: sessionFrom(res) });
    expect(orgs.json().organizations[0]).toMatchObject({ id: tenants.ids.orgA, role: "admin" });
    expect((await accept(token, STRONG)).json().error.code).toBe("INVITE_INVALID");
  });

  it("two parallel accepts of one token: exactly one wins", async () => {
    const token = await inviteToken("race@helium.test");
    const results = await Promise.all([accept(token, STRONG), accept(token, STRONG)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 400]); // the loser sees a used invite
    const [n] = await t.sql`SELECT count(*)::int AS n FROM users WHERE email = 'race@helium.test'`;
    expect(n?.n).toBe(1);
  });

  it("unknown, used, expired and suspended invites all get the same answer", async () => {
    const unknown = await accept("A".repeat(43), STRONG);
    const expired = await inviteToken("late@helium.test");
    await t.sql`UPDATE invites SET created_at = now() - interval '4 days',
                                   expires_at = now() - interval '1 day'`;
    const suspended = await inviteToken("s@helium.test");
    await t.sql`UPDATE organizations SET suspended_at = now() WHERE id = ${tenants.ids.orgA}`;
    for (const token of [expired, suspended]) {
      const res = await accept(token, STRONG);
      expect(res.statusCode).toBe(400);
      expect(bodyWithoutRequestId(res.json())).toEqual(bodyWithoutRequestId(unknown.json()));
    }
    const [users] = await t.sql`SELECT count(*)::int AS n FROM users`;
    expect(users?.n).toBe(5);
  });
});

describe("accepting an invite with an existing account (spec §11)", () => {
  it("requires that account's password; a wrong one leaves the invite open", async () => {
    const email = "owner@other.test";
    await createOwner(t.sql, { email, password: STRONG, organizationName: "Other" });
    const token = await inviteToken(email);
    expect((await preview(token)).json().accountExists).toBe(true);
    expect((await accept(token, "not the right password")).statusCode).toBe(401);
    const res = await accept(token, STRONG);
    expect(res.statusCode).toBe(200);
    const orgs = await t.get("/organizations", { cookie: sessionFrom(res) });
    expect(orgs.json().organizations).toHaveLength(2);
    const actions = await t.sql<{ action: string }[]>`
      SELECT action FROM audit_logs WHERE action LIKE 'auth.%' OR action = 'invite.accepted'
      ORDER BY id`;
    expect(actions.map((a) => a.action)).toEqual([
      "auth.login_failed",
      "invite.accepted",
      "auth.login_succeeded",
    ]);
  });
});
