import type { CreatedInvite, CreateInviteRequest, InviteListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { canInviteAs, type OrgRole } from "../../domain/org-roles.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError, notFound } from "../../http/app-error.js";
import { organizationInScope } from "../access/in-scope.js";
import { recordAudit } from "../audit/record-audit.js";
import { lockOrganizationAs } from "../organizations/org-lock.js";
import { insertInvite } from "./insert-invite.js";
import { INVITE_SELECT, type InviteRow, toInvite } from "./invite-row.js";

// `org:invite` (owners and admins). Role limits come from `canInviteAs`; the role is read again
// under the organization lock so a just-demoted admin cannot slip one through.

const forbidden = () => new AppError(403, "FORBIDDEN", "Not allowed");

export async function createInvite(
  sql: Sql,
  scope: AccessScope,
  input: CreateInviteRequest & { organizationId: string; publicOrigin: string },
): Promise<CreatedInvite> {
  const organizationId = organizationInScope(scope, input.organizationId);
  return sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, organizationId, scope.userId);
    if (!canInviteAs(actorRole, input.role)) throw forbidden();
    return insertInvite(tx, { ...input, organizationId, actorUserId: scope.userId });
  });
}

/** Newest 100, any status. */
export async function listInvites(
  sql: Sql,
  scope: AccessScope,
  organizationId: string,
): Promise<InviteListResponse> {
  const rows = await sql<InviteRow[]>`
    SELECT ${INVITE_SELECT(sql)} FROM invites i
    WHERE i.organization_id = ${organizationInScope(scope, organizationId)}
    ORDER BY i.created_at DESC, i.id LIMIT 100`;
  return { invites: rows.map(toInvite) };
}

/** Idempotent for revoked invites; an accepted invite cannot be revoked (remove the member). */
export async function revokeInvite(
  sql: Sql,
  scope: AccessScope,
  input: { organizationId: string; inviteId: string },
): Promise<void> {
  const organizationId = organizationInScope(scope, input.organizationId);
  await sql.begin(async (tx) => {
    const actorRole = await lockOrganizationAs(tx, organizationId, scope.userId);
    const [invite] = await tx<{ role: OrgRole; acceptedAt: Date | null; revokedAt: Date | null }[]>`
      SELECT role, accepted_at, revoked_at FROM invites
      WHERE id = ${input.inviteId} AND organization_id = ${organizationId}`;
    if (!invite) throw notFound();
    if (!canInviteAs(actorRole, invite.role)) throw forbidden();
    if (invite.acceptedAt) throw new AppError(409, "INVITE_ACCEPTED", "Invite already accepted");
    if (invite.revokedAt) return;
    await tx`UPDATE invites SET revoked_at = now() WHERE id = ${input.inviteId}`;
    await recordAudit(tx, {
      action: "invite.revoked",
      actorUserId: scope.userId,
      organizationId,
      target: { type: "invite", id: input.inviteId },
      details: { role: invite.role },
    });
  });
}
