import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSql } from "../../db/db.module.js";
import { resetDb } from "../../test-support/reset-db.js";
import * as seed from "../../test-support/seed-org.js";
import { testEnv } from "../../test-support/test-env.js";
import {
  createOrganization,
  setOrganizationSuspended,
} from "../organizations/platform-organizations.js";
import { PlatformAdminError, setPlatformAdmin } from "./platform-admin.js";

const sql = createSql(testEnv());
afterAll(() => sql.end());
beforeEach(() => resetDb());

const isAdmin = async (id: string) =>
  (await sql`SELECT is_platform_admin FROM users WHERE id = ${id}`)[0]?.isPlatformAdmin;

describe("platform admin (spec §9.1, §11)", () => {
  it("grant and revoke flip the flag and revoke sessions only on a real change", async () => {
    const org = await seed.seedOrg(sql, "ops");
    const user = await seed.seedMember(sql, org, "ops@x.test", "owner");
    await seed.seedSession(sql, user);
    expect(await setPlatformAdmin(sql, " OPS@x.test ", true)).toBe(true);
    expect(await isAdmin(user)).toBe(true);
    const [left] = await sql`SELECT count(*)::int AS n FROM auth_sessions`;
    expect(left?.n).toBe(0);
    await seed.seedSession(sql, user);
    expect(await setPlatformAdmin(sql, "ops@x.test", true)).toBe(false);
    const [kept] = await sql`SELECT count(*)::int AS n FROM auth_sessions`;
    expect(kept?.n).toBe(1);
    expect(await setPlatformAdmin(sql, "ops@x.test", false)).toBe(true);
    expect(await isAdmin(user)).toBe(false);
  });

  it("unknown or invalid emails are reported, not created", async () => {
    await expect(setPlatformAdmin(sql, "who@x.test", true)).rejects.toBeInstanceOf(
      PlatformAdminError,
    );
    await expect(setPlatformAdmin(sql, "nope", true)).rejects.toBeInstanceOf(PlatformAdminError);
  });

  it("only platform admins create and suspend organizations; they do not become members", async () => {
    const admin = { isPlatformAdmin: true };
    await expect(createOrganization(sql, { isPlatformAdmin: false }, "Acme")).rejects.toMatchObject(
      {
        status: 403,
      },
    );
    const created = await createOrganization(sql, admin, "Acme");
    expect(created.slug).toBe("acme");
    const [members] = await sql`SELECT count(*)::int AS n FROM memberships`;
    expect(members?.n).toBe(0);
    await setOrganizationSuspended(sql, admin, created.organizationId, true);
    const [row] =
      await sql`SELECT suspended_at FROM organizations WHERE id = ${created.organizationId}`;
    expect(row?.suspendedAt).toBeInstanceOf(Date);
    await setOrganizationSuspended(sql, admin, created.organizationId, false);
    const missing = setOrganizationSuspended(sql, admin, crypto.randomUUID(), true);
    await expect(missing).rejects.toMatchObject({ status: 404 });
  });
});
