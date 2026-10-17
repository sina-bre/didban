import type postgres from "postgres";
import type { OrgRole, RoleRefusal } from "../../domain/org-roles.js";
import { AppError, notFound } from "../../http/app-error.js";

/**
 * Locks the organization row for the rest of the transaction and returns the actor's role in it.
 * Every membership change takes this lock first, so two concurrent "demote the other owner"
 * requests run one after the other and the second one sees the first one's result.
 * A non-member gets the same 404 as a missing organization (existence hiding, spec §11).
 */
export async function lockOrganizationAs(
  tx: postgres.TransactionSql,
  organizationId: string,
  actorUserId: string,
): Promise<OrgRole> {
  const [org] = await tx`SELECT 1 FROM organizations WHERE id = ${organizationId} FOR UPDATE`;
  if (!org) throw notFound();
  const role = await orgRoleOf(tx, organizationId, actorUserId);
  if (!role) throw notFound();
  return role;
}

export async function orgRoleOf(
  tx: postgres.TransactionSql,
  organizationId: string,
  userId: string,
): Promise<OrgRole | undefined> {
  const [row] = await tx<{ role: OrgRole }[]>`
    SELECT role FROM memberships WHERE organization_id = ${organizationId} AND user_id = ${userId}`;
  return row?.role;
}

export async function countOwners(
  tx: postgres.TransactionSql,
  organizationId: string,
): Promise<number> {
  const [row] = await tx<{ n: number }[]>`
    SELECT count(*)::int AS n FROM memberships
    WHERE organization_id = ${organizationId} AND role = 'owner'`;
  return row?.n ?? 0;
}

export function refusalError(refusal: RoleRefusal): AppError {
  return refusal === "last_owner"
    ? new AppError(409, "LAST_OWNER", "An organization must keep at least one owner")
    : new AppError(403, "FORBIDDEN", "Not allowed");
}
