import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSql } from "../../db/db.module.js";
import { resetDb } from "../../test-support/reset-db.js";
import * as seed from "../../test-support/seed-org.js";
import { testEnv } from "../../test-support/test-env.js";
import { assignProjectMember, removeProjectMember } from "./project-members.js";

const sql = createSql(testEnv());
afterAll(() => sql.end());
beforeEach(() => resetDb());

async function world() {
  const orgA = await seed.seedOrg(sql, "heliumpark");
  const adminA = await seed.seedMember(sql, orgA, "admin@helium.test", "admin");
  const pAdmin = await seed.seedMember(sql, orgA, "padmin@helium.test", "member");
  const viewer = await seed.seedMember(sql, orgA, "viewer@helium.test", "member");
  const outsider = await seed.seedMember(sql, orgA, "none@helium.test", "member");
  const project = await seed.seedProject(sql, orgA, "heliumpark");
  await seed.seedProjectMember(sql, project, orgA, pAdmin, "project_admin");
  await seed.seedProjectMember(sql, project, orgA, viewer, "viewer");
  const orgB = await seed.seedOrg(sql, "another-website");
  const ownerB = await seed.seedMember(sql, orgB, "b@another.test", "owner");
  return { orgA, adminA, pAdmin, viewer, outsider, project, ownerB };
}

const projectRole = async (projectId: string, userId: string) =>
  (
    await sql`SELECT role FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}`
  )[0]?.role;

describe("project members (spec §11 permission table)", () => {
  it("org admins and the project's admins assign and change access", async () => {
    const { adminA, pAdmin, outsider, project } = await world();
    await assignProjectMember(sql, {
      actorUserId: adminA,
      projectId: project,
      userId: outsider,
      role: "viewer",
    });
    expect(await projectRole(project, outsider)).toBe("viewer");
    await assignProjectMember(sql, {
      actorUserId: pAdmin,
      projectId: project,
      userId: outsider,
      role: "project_admin",
    });
    expect(await projectRole(project, outsider)).toBe("project_admin");
    await removeProjectMember(sql, { actorUserId: pAdmin, projectId: project, userId: outsider });
    expect(await projectRole(project, outsider)).toBeUndefined();
  });

  it("a viewer gets 403; an org member without access gets 404", async () => {
    const { viewer, outsider, project } = await world();
    const input = { projectId: project, userId: outsider, role: "viewer" as const };
    await expect(assignProjectMember(sql, { ...input, actorUserId: viewer })).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      assignProjectMember(sql, { ...input, actorUserId: outsider }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("project members: tenant isolation (spec §11, §16)", () => {
  it("another organization's owner gets 404 and cannot add themself", async () => {
    const { ownerB, project } = await world();
    const input = {
      actorUserId: ownerB,
      projectId: project,
      userId: ownerB,
      role: "viewer" as const,
    };
    await expect(assignProjectMember(sql, input)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await expect(removeProjectMember(sql, input)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses users from other organizations, also at the database level", async () => {
    const { orgA, adminA, ownerB, project } = await world();
    const input = {
      actorUserId: adminA,
      projectId: project,
      userId: ownerB,
      role: "viewer" as const,
    };
    await expect(assignProjectMember(sql, input)).rejects.toMatchObject({ status: 404 });
    const direct = seed.seedProjectMember(sql, project, orgA, ownerB, "viewer");
    await expect(direct).rejects.toMatchObject({ code: "23503" }); // composite FK through org
  });

  it("archived projects are not found", async () => {
    const { adminA, outsider, project } = await world();
    await sql`UPDATE projects SET archived_at = now() WHERE id = ${project}`;
    const input = {
      actorUserId: adminA,
      projectId: project,
      userId: outsider,
      role: "viewer" as const,
    };
    await expect(assignProjectMember(sql, input)).rejects.toMatchObject({ status: 404 });
  });
});
