import {
  type CreatedInvite,
  INVITE_TTL_HOURS,
  MAX_OPEN_INVITES_PER_ORGANIZATION,
} from "@didban/contracts";
import type postgres from "postgres";
import type { OrgRole } from "../../domain/org-roles.js";
import { AppError } from "../../http/app-error.js";
import { recordAudit } from "../audit/record-audit.js";
import { hashSessionToken, newSessionToken } from "../auth/session-token.js";
import { INVITE_SELECT, type InviteRow, toInvite } from "./invite-row.js";

export type NewInvite = {
  organizationId: string;
  email: string;
  role: OrgRole;
  actorUserId: string;
  publicOrigin: string;
};

/**
 * Shared by org owners/admins and platform admins. The caller holds the organization row lock,
 * so the open-invite cap is exact. An open invite for the same email is revoked and replaced.
 */
export async function insertInvite(
  tx: postgres.TransactionSql,
  input: NewInvite,
): Promise<CreatedInvite> {
  const [member] = await tx`
    SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = ${input.organizationId} AND u.email = ${input.email}`;
  if (member) throw new AppError(409, "ALREADY_MEMBER", "This person is already a member");
  await replaceOpenInvite(tx, input);
  const [open] = await tx<{ n: number }[]>`
    SELECT count(*)::int AS n FROM invites
    WHERE organization_id = ${input.organizationId}
      AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
  if ((open?.n ?? 0) >= MAX_OPEN_INVITES_PER_ORGANIZATION) {
    throw new AppError(409, "INVITE_LIMIT_REACHED", "Too many open invites");
  }
  const token = newSessionToken();
  const [row] = await tx<InviteRow[]>`
    INSERT INTO invites AS i (organization_id, email, role, token_hash, created_by, expires_at)
    VALUES (${input.organizationId}, ${input.email}, ${input.role}, ${hashSessionToken(token)},
            ${input.actorUserId}, now() + make_interval(hours => ${INVITE_TTL_HOURS}))
    RETURNING ${INVITE_SELECT(tx)}`;
  if (!row) throw new Error("insert returned no row");
  await audit(tx, input, "invite.created", row.id);
  return { ...toInvite(row), acceptUrl: `${input.publicOrigin}/accept-invite#${token}` };
}

async function replaceOpenInvite(tx: postgres.TransactionSql, input: NewInvite): Promise<void> {
  const replaced = await tx<{ id: string }[]>`
    UPDATE invites SET revoked_at = now()
    WHERE organization_id = ${input.organizationId} AND email = ${input.email}
      AND accepted_at IS NULL AND revoked_at IS NULL
    RETURNING id`;
  for (const { id } of replaced) await audit(tx, input, "invite.revoked", id);
}

function audit(
  tx: postgres.TransactionSql,
  input: NewInvite,
  action: "invite.created" | "invite.revoked",
  inviteId: string,
) {
  return recordAudit(tx, {
    action,
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    target: { type: "invite", id: inviteId },
    details: { role: input.role },
  });
}
