import type { CreatedUser, CreateUserRequest } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { canCreateUserAs } from "../../domain/org-roles.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { organizationInScope } from "../access/in-scope.js";
import { lockOrganizationAs } from "../organizations/org-lock.js";
import { insertUser, temporaryCredentials } from "./insert-user.js";

/**
 * ADR 0024 (`org:users`): an owner or admin creates an account in their organization; admins
 * create plain members only. The role is re-read under the organization row lock.
 */
export async function createUser(
  sql: Sql,
  scope: AccessScope,
  input: CreateUserRequest & { organizationId: string },
): Promise<CreatedUser> {
  const organizationId = organizationInScope(scope, input.organizationId);
  const credentials = await temporaryCredentials();
  return sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, organizationId, scope.userId);
    if (!canCreateUserAs(actorRole, input.role)) {
      throw new AppError(403, "FORBIDDEN", "Not allowed");
    }
    const actorUserId = scope.userId;
    return insertUser(tx, { ...input, ...credentials, organizationId, actorUserId });
  });
}

/**
 * Spec §11: a platform admin gives an organization an owner (e.g. one they created). They do
 * not become a member themselves. Suspended organizations get no new users.
 */
export async function createOwnerAsPlatformAdmin(
  sql: Sql,
  actor: { userId: string; isPlatformAdmin: boolean },
  input: { organizationId: string; email: string },
): Promise<CreatedUser> {
  if (!actor.isPlatformAdmin) throw new AppError(403, "FORBIDDEN", "Not allowed");
  const credentials = await temporaryCredentials();
  return sql.begin(async (tx) => {
    const [org] = await tx`
      SELECT 1 FROM organizations
      WHERE id = ${input.organizationId} AND suspended_at IS NULL FOR UPDATE`;
    if (!org) throw notFound();
    const owner = { ...input, ...credentials, role: "owner" as const, actorUserId: actor.userId };
    return insertUser(tx, owner);
  });
}
