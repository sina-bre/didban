import type { CreatedUser } from "@didban/contracts";
import type postgres from "postgres";
import type { OrgRole } from "../../domain/org-roles.js";
import { AppError } from "../../http/app-error.js";
import { recordAudit } from "../audit/record-audit.js";
import { hashPassword } from "../auth/password-hasher.js";
import { newTemporaryPassword } from "../auth/temporary-password.js";

export type NewUser = {
  organizationId: string;
  email: string;
  role: OrgRole;
  actorUserId: string;
  passwordHash: string;
  temporaryPassword: string;
};

/** Argon2 is slow on purpose: run this before taking any row lock. */
export async function temporaryCredentials() {
  const temporaryPassword = newTemporaryPassword();
  return { temporaryPassword, passwordHash: await hashPassword(temporaryPassword) };
}

/**
 * ADR 0024: a new account with a temporary password and one membership, plus its audit row.
 * An email that already has an account is refused (no pulling accounts across organizations).
 */
export async function insertUser(tx: postgres.TransactionSql, user: NewUser): Promise<CreatedUser> {
  const [row] = await tx<{ id: string }[]>`
    INSERT INTO users (email, password_hash, must_change_password)
    VALUES (${user.email}, ${user.passwordHash}, true)
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  if (!row) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
  await tx`INSERT INTO memberships (user_id, organization_id, role)
           VALUES (${row.id}, ${user.organizationId}, ${user.role})`;
  await recordAudit(tx, {
    action: "user.created",
    actorUserId: user.actorUserId,
    organizationId: user.organizationId,
    target: { type: "user", id: row.id },
    details: { role: user.role },
  });
  const { email, role, temporaryPassword } = user;
  return { userId: row.id, email, role, temporaryPassword };
}
