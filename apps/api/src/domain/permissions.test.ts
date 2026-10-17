import { describe, expect, it } from "vitest";
import type { OrgRole, ProjectRole } from "./org-roles.js";
import { type AccessScope, decide } from "./permissions.js";

const ORG = "org-a";
const PROJECT = "project-a";

function scopeAs(orgRole: OrgRole | null, projectRole: ProjectRole | null = null): AccessScope {
  const reachesProject = orgRole === "owner" || orgRole === "admin" || projectRole !== null;
  return {
    userId: "u",
    isPlatformAdmin: false,
    organizations: new Map(orgRole ? [[ORG, orgRole]] : []),
    projects: new Map(
      orgRole && reachesProject ? [[PROJECT, { organizationId: ORG, orgRole, projectRole }]] : [],
    ),
  };
}
const onProject = { projectId: PROJECT };
const onOrg = { organizationId: ORG };

describe("decide (spec §11 permission table)", () => {
  it("project rows: view for anyone assigned, manage/members for admins only", () => {
    const viewer = scopeAs("member", "viewer");
    expect(decide(viewer, "project:view", onProject)).toBe("allow");
    expect(decide(viewer, "project:manage", onProject)).toBe("forbidden");
    expect(decide(viewer, "project:members", onProject)).toBe("forbidden");
    const projectAdmin = scopeAs("member", "project_admin");
    expect(decide(projectAdmin, "project:manage", onProject)).toBe("allow");
    expect(decide(projectAdmin, "project:members", onProject)).toBe("allow");
    expect(decide(scopeAs("admin"), "project:manage", onProject)).toBe("allow");
  });

  it("an org member without a project row, and outsiders, get not_found", () => {
    expect(decide(scopeAs("member"), "project:view", onProject)).toBe("not_found");
    expect(decide(scopeAs(null), "project:view", onProject)).toBe("not_found");
    expect(decide(scopeAs(null), "org:roles", onOrg)).toBe("not_found");
    expect(decide(scopeAs("owner"), "project:view", {})).toBe("not_found");
  });

  it("org rows: roles are owner-only, projects owner/admin; members see the org (403)", () => {
    expect(decide(scopeAs("owner"), "org:roles", onOrg)).toBe("allow");
    expect(decide(scopeAs("admin"), "org:roles", onOrg)).toBe("forbidden");
    expect(decide(scopeAs("admin"), "org:projects", onOrg)).toBe("allow");
    expect(decide(scopeAs("member"), "org:projects", onOrg)).toBe("forbidden");
  });

  it("platform admin: platform routes only; tenant data stays hidden", () => {
    const admin = { ...scopeAs(null), isPlatformAdmin: true };
    expect(decide(admin, "platform", {})).toBe("allow");
    expect(decide(scopeAs("owner"), "platform", {})).toBe("forbidden");
    expect(decide(admin, "project:view", onProject)).toBe("not_found");
    expect(decide(admin, "org:projects", onOrg)).toBe("not_found");
    expect(decide(scopeAs(null), "self", {})).toBe("allow");
  });
});
