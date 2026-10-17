import type { CreatedUser, CreateUserRequest } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { canCreateUserAs } from "../../domain/org-roles.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { organizationInScope } from "../access/in-scope.js";
import { recordAudit } from "../audit/record-audit.js";
import { hashPassword } from "../auth/password-hasher.js";
import { newTemporaryPassword } from "../auth/temporary-password.js";
import { lockOrganizationAs } from "../organizations/org-lock.js";

/**
 * ADR 0024 (`org:users`): an owner or admin creates an account in their organization. The server
 * picks a temporary password, returned once; the user must replace it at first login. An email
 * that already has an account is refused: attaching an existing account to another organization
 * is an operator action, so an org admin cannot pull in people from other organizations.
 */
export async function createUser(
  sql: Sql,
  scope: AccessScope,
  input: CreateUserRequest & { organizationId: string },
): Promise<CreatedUser> {
  const organizationId = organizationInScope(scope, input.organizationId);
  const temporaryPassword = newTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword); // before any lock is taken
  return sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, organizationId, scope.userId);
    if (!canCreateUserAs(actorRole, input.role)) {
      throw new AppError(403, "FORBIDDEN", "Not allowed");
    }
    const [user] = await tx<{ id: string }[]>`
      INSERT INTO users (email, password_hash, must_change_password)
      VALUES (${input.email}, ${passwordHash}, true)
      ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!user) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    await tx`INSERT INTO memberships (user_id, organization_id, role)
             VALUES (${user.id}, ${organizationId}, ${input.role})`;
    await recordAudit(tx, {
      action: "user.created",
      actorUserId: scope.userId,
      organizationId,
      target: { type: "user", id: user.id },
      details: { role: input.role },
    });
    return { userId: user.id, email: input.email, role: input.role, temporaryPassword };
  });
}
