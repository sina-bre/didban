import { describe, expect, it } from "vitest";
import { canManageProjectMembers, checkMemberChange } from "./org-roles.js";

describe("checkMemberChange (spec §11 last-owner rule)", () => {
  it("lets an owner demote or remove another owner while one remains", () => {
    const base = { actorRole: "owner", targetRole: "owner", ownerCount: 2 } as const;
    expect(checkMemberChange({ ...base, newRole: "admin" })).toBeNull();
    expect(checkMemberChange({ ...base, newRole: null })).toBeNull();
  });

  it("refuses to demote or remove the final owner, including themself", () => {
    const base = { actorRole: "owner", targetRole: "owner", ownerCount: 1 } as const;
    expect(checkMemberChange({ ...base, newRole: "member" })).toBe("last_owner");
    expect(checkMemberChange({ ...base, newRole: null })).toBe("last_owner");
    expect(checkMemberChange({ ...base, newRole: "owner" })).toBeNull();
  });

  it("refuses role changes and removals by admins and members", () => {
    for (const actorRole of ["admin", "member"] as const) {
      const change = { actorRole, targetRole: "member", newRole: "admin", ownerCount: 1 } as const;
      expect(checkMemberChange(change)).toBe("forbidden");
      expect(checkMemberChange({ ...change, newRole: null })).toBe("forbidden");
    }
  });

  it("lets an owner promote a member to owner", () => {
    const change = {
      actorRole: "owner",
      targetRole: "member",
      newRole: "owner",
      ownerCount: 1,
    } as const;
    expect(checkMemberChange(change)).toBeNull();
  });
});

describe("canManageProjectMembers", () => {
  it("allows org owners/admins and the project's own admins only", () => {
    expect(canManageProjectMembers("owner", null)).toBe(true);
    expect(canManageProjectMembers("admin", null)).toBe(true);
    expect(canManageProjectMembers("member", "project_admin")).toBe(true);
    expect(canManageProjectMembers("member", "viewer")).toBe(false);
    expect(canManageProjectMembers("member", null)).toBe(false);
  });
});
