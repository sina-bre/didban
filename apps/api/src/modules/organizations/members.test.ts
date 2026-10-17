import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSql } from "../../db/db.module.js";
import { resetDb } from "../../test-support/reset-db.js";
import * as seed from "../../test-support/seed-org.js";
import { testEnv } from "../../test-support/test-env.js";
import { changeMemberRole } from "./change-member-role.js";
import { removeMember } from "./remove-member.js";

const sql = createSql(testEnv());
afterAll(() => sql.end());
beforeEach(() => resetDb());

async function twoOrgs() {
  const orgA = await seed.seedOrg(sql, "heliumpark");
  const ownerA = await seed.seedMember(sql, orgA, "a@helium.test", "owner");
  const adminA = await seed.seedMember(sql, orgA, "admin@helium.test", "admin");
  const memberA = await seed.seedMember(sql, orgA, "m@helium.test", "member");
  const orgB = await seed.seedOrg(sql, "another-website");
  const ownerB = await seed.seedMember(sql, orgB, "b@another.test", "owner");
  return { orgA, ownerA, adminA, memberA, orgB, ownerB };
}

const roleOf = async (orgId: string, userId: string) =>
  (
    await sql`SELECT role FROM memberships WHERE organization_id = ${orgId} AND user_id = ${userId}`
  )[0]?.role;

describe("changeMemberRole / removeMember (spec §11, §16 last-owner rule)", () => {
  it("rejects demoting or removing the last owner, even by themself", async () => {
    const { orgA, ownerA } = await twoOrgs();
    const demote = {
      actorUserId: ownerA,
      organizationId: orgA,
      userId: ownerA,
      role: "admin" as const,
    };
    await expect(changeMemberRole(sql, demote)).rejects.toMatchObject({
      status: 409,
      code: "LAST_OWNER",
    });
    await expect(removeMember(sql, demote)).rejects.toMatchObject({ code: "LAST_OWNER" });
    expect(await roleOf(orgA, ownerA)).toBe("owner");
  });

  it("concurrent mutual demotion of two owners leaves exactly one owner", async () => {
    const { orgA, ownerA, adminA } = await twoOrgs();
    await sql`UPDATE memberships SET role = 'owner' WHERE user_id = ${adminA}`;
    const results = await Promise.allSettled([
      changeMemberRole(sql, {
        actorUserId: ownerA,
        organizationId: orgA,
        userId: adminA,
        role: "admin",
      }),
      changeMemberRole(sql, {
        actorUserId: adminA,
        organizationId: orgA,
        userId: ownerA,
        role: "admin",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [count] =
      await sql`SELECT count(*)::int AS n FROM memberships WHERE role = 'owner' AND organization_id = ${orgA}`;
    expect(count?.n).toBe(1);
  });
});

describe("changeMemberRole / removeMember (spec §11 permission table)", () => {
  it("lets only owners change roles; a change revokes the target's sessions", async () => {
    const { orgA, ownerA, adminA, memberA } = await twoOrgs();
    const promote = { organizationId: orgA, userId: memberA, role: "admin" as const };
    await expect(changeMemberRole(sql, { ...promote, actorUserId: adminA })).rejects.toMatchObject({
      status: 403,
    });
    await seed.seedSession(sql, memberA);
    await changeMemberRole(sql, { ...promote, actorUserId: ownerA });
    expect(await roleOf(orgA, memberA)).toBe("admin");
    const [sessions] =
      await sql`SELECT count(*)::int AS n FROM auth_sessions WHERE user_id = ${memberA}`;
    expect(sessions?.n).toBe(0);
  });

  it("removal deletes the membership and its project access", async () => {
    const { orgA, ownerA, memberA } = await twoOrgs();
    const project = await seed.seedProject(sql, orgA, "site");
    await seed.seedProjectMember(sql, project, orgA, memberA, "viewer");
    await removeMember(sql, { actorUserId: ownerA, organizationId: orgA, userId: memberA });
    expect(await roleOf(orgA, memberA)).toBeUndefined();
    const rows = await sql`SELECT 1 FROM project_members WHERE user_id = ${memberA}`;
    expect(rows).toHaveLength(0);
  });

  it("another organization's owner gets 404 (existence hiding), not 403", async () => {
    const { orgA, memberA, ownerB } = await twoOrgs();
    const input = { actorUserId: ownerB, organizationId: orgA, userId: memberA };
    await expect(removeMember(sql, input)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await expect(changeMemberRole(sql, { ...input, role: "admin" })).rejects.toMatchObject({
      status: 404,
    });
    const missing = { ...input, organizationId: crypto.randomUUID() };
    await expect(removeMember(sql, missing)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
