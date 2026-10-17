import { emailSchema } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { recordAudit } from "../audit/record-audit.js";
import { hashPassword } from "../auth/password-hasher.js";
import { checkPassword } from "../auth/password-policy.js";
import { insertOrganization } from "../organizations/insert-organization.js";

export type CreateOwnerInput = { email: string; password: string; organizationName: string };
export type CreateOwnerResult = { userId: string; organizationId: string; slug: string };

export class CreateOwnerError extends Error {}

/** Spec §11: no public signup; the CLI creates a user, an organization and the owner membership. */
export async function createOwner(sql: Sql, input: CreateOwnerInput): Promise<CreateOwnerResult> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) throw new CreateOwnerError("That is not a valid email address.");
  const problem = checkPassword(input.password);
  if (problem) {
    const length = [...input.password].length;
    throw new CreateOwnerError(`Password rejected: ${problem} (received ${length} characters).`);
  }
  const passwordHash = await hashPassword(input.password);
  return sql.begin(async (tx) => {
    const [taken] = await tx`SELECT 1 FROM users WHERE email = ${email.data}`;
    if (taken) throw new CreateOwnerError("A user with that email already exists.");
    const { organizationId, slug } = await insertOrganization(tx, input.organizationName);
    const [user] = await tx<{ id: string }[]>`
      INSERT INTO users (email, password_hash) VALUES (${email.data}, ${passwordHash}) RETURNING id`;
    if (!user) throw new Error("insert returned no row");
    await tx`INSERT INTO memberships (user_id, organization_id, role)
             VALUES (${user.id}, ${organizationId}, 'owner')`;
    // CLI: no request, no actor. The operator with shell access is trusted by definition (spec Â§11).
    await recordAudit(tx, {
      action: "organization.created",
      actorUserId: null,
      organizationId,
      target: { type: "user", id: user.id },
      details: { role: "owner" },
    });
    return { userId: user.id, organizationId, slug };
  });
}
