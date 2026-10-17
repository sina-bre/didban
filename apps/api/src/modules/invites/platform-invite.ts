import type { CreatedInvite } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { AppError, notFound } from "../../http/app-error.js";
import { insertInvite } from "./insert-invite.js";

export type OwnerInviteInput = { organizationId: string; email: string; publicOrigin: string };

/**
 * Spec §11: a platform admin creates an organization's first owner invite. They still do not
 * become a member, so they cannot read its data. Suspended organizations get no invites.
 */
export async function createOwnerInvite(
  sql: Sql,
  actor: { userId: string; isPlatformAdmin: boolean },
  input: OwnerInviteInput,
): Promise<CreatedInvite> {
  if (!actor.isPlatformAdmin) throw new AppError(403, "FORBIDDEN", "Not allowed");
  return sql.begin(async (tx) => {
    const [org] = await tx`
      SELECT 1 FROM organizations
      WHERE id = ${input.organizationId} AND suspended_at IS NULL FOR UPDATE`;
    if (!org) throw notFound();
    return insertInvite(tx, { ...input, role: "owner", actorUserId: actor.userId });
  });
}
