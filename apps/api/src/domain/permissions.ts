import type { OrgRole, ProjectRole } from "./org-roles.js";

// Spec §11 permission table as one decision function. The guard loads the facts (AccessScope) and
// asks here. Targets the principal cannot see are "not_found" (404), never "forbidden" (403).

/** What the principal can reach. Suspended organizations and archived projects are left out. */
export type AccessScope = {
  userId: string;
  isPlatformAdmin: boolean;
  organizations: ReadonlyMap<string, OrgRole>;
  projects: ReadonlyMap<string, ProjectAccess>;
};

export type ProjectAccess = {
  organizationId: string;
  orgRole: OrgRole;
  /** `null` when access comes from being an org owner/admin without a project row. */
  projectRole: ProjectRole | null;
};

export const PERMISSIONS = [
  "self", // any signed-in user, about themself (me, logout, password, own lists)
  "platform", // instance operator: create/suspend organizations
  "org:roles", // change org roles, remove users
  "org:projects", // create or archive projects
  "org:audit", // read the organization's audit log
  "org:invite", // invite members, list and revoke invites (role limits in the use case)
  "project:view", // read a project's stats
  "project:manage", // environments, goals, routes, keys, shares, deletions
  "project:members", // assign project access to existing org members
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Decision = "allow" | "not_found" | "forbidden";
/** Route params by convention: `:organizationId` for `org:*`, `:projectId` for `project:*`. */
export type Target = { organizationId?: string; projectId?: string };

const ORG_RULES: Record<string, readonly OrgRole[]> = {
  "org:roles": ["owner"],
  "org:projects": ["owner", "admin"],
  "org:audit": ["owner", "admin"],
  "org:invite": ["owner", "admin"],
};

export function decide(scope: AccessScope, permission: Permission, target: Target): Decision {
  if (permission === "self") return "allow";
  if (permission === "platform") return scope.isPlatformAdmin ? "allow" : "forbidden";
  return permission.startsWith("org:")
    ? decideOrg(scope, permission, target.organizationId)
    : decideProject(scope, permission, target.projectId);
}

function decideOrg(scope: AccessScope, permission: Permission, id: string | undefined): Decision {
  const role = id && scope.organizations.get(id);
  if (!role) return "not_found";
  return ORG_RULES[permission]?.includes(role) ? "allow" : "forbidden";
}

function decideProject(scope: AccessScope, permission: Permission, id?: string): Decision {
  const access = id && scope.projects.get(id);
  if (!access) return "not_found";
  if (permission === "project:view") return "allow";
  return canAdministerProject(access) ? "allow" : "forbidden";
}

/** Manage and assign members: org owner/admin, or project admin of this project. */
function canAdministerProject(access: ProjectAccess): boolean {
  return (
    access.orgRole === "owner" ||
    access.orgRole === "admin" ||
    access.projectRole === "project_admin"
  );
}
