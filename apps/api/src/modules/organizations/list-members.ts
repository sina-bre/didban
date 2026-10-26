import type { OrganizationMemberListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { OrgRole } from "../../domain/org-roles.js";
import type { AccessScope } from "../../domain/permissions.js";
import { organizationInScope } from "../access/in-scope.js";

type Row = {
  userId: string;
  email: string;
  role: OrgRole;
  mustChangePassword: boolean;
  joinedAt: Date;
};

/** The organization's members for its settings page (`org:users`: owners and admins). */
export async function listMembers(
  sql: Sql,
  scope: AccessScope,
  organizationId: string,
): Promise<OrganizationMemberListResponse> {
  const rows = await sql<Row[]>`
    SELECT u.id AS user_id, u.email, m.role, u.must_change_password, m.created_at AS joined_at
    FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = ${organizationInScope(scope, organizationId)}
    ORDER BY u.email`;
  return { members: rows.map((row) => ({ ...row, joinedAt: row.joinedAt.toISOString() })) };
}
