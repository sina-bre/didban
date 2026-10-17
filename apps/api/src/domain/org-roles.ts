// Spec §11 permission table, organization and project-member rows. Pure rules: callers load the
// facts (roles, owner count) inside a transaction that locks the organization, then ask here.

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const PROJECT_ROLES = ["project_admin", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Why a change is refused. `forbidden` → 403, `last_owner` → 409. */
export type RoleRefusal = "forbidden" | "last_owner";

export type MemberChange = {
  actorRole: OrgRole;
  targetRole: OrgRole;
  /** The new role, or `null` when the member is being removed. */
  newRole: OrgRole | null;
  ownerCount: number;
};

/** Only owners change org roles or remove users; the final owner can be neither demoted nor removed. */
export function checkMemberChange(change: MemberChange): RoleRefusal | null {
  if (change.actorRole !== "owner") return "forbidden";
  const losesOwner = change.targetRole === "owner" && change.newRole !== "owner";
  if (losesOwner && change.ownerCount <= 1) return "last_owner";
  return null;
}

/** Org owners and admins assign project access anywhere; a project admin only on their own project. */
export function canManageProjectMembers(
  orgRole: OrgRole,
  projectRole: ProjectRole | null,
): boolean {
  return orgRole === "owner" || orgRole === "admin" || projectRole === "project_admin";
}
