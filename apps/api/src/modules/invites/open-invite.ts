import type { InvitePreview } from "@didban/contracts";
import type postgres from "postgres";
import type { Sql } from "../../db/db.module.js";
import type { OrgRole } from "../../domain/org-roles.js";
import { AppError } from "../../http/app-error.js";
import { hashSessionToken } from "../auth/session-token.js";
import { INVALID_INVITE } from "./invite-row.js";

export type OpenInvite = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: OrgRole;
  userId: string | null;
};

const invalid = () =>
  new AppError(INVALID_INVITE.status, INVALID_INVITE.code, INVALID_INVITE.message);

/**
 * The invite behind a token if it can still be accepted: not used, revoked or expired, and its
 * organization not suspended. `lock` takes the invite row lock (accept); preview reads only.
 */
export async function findOpenInvite(
  sql: Sql | postgres.TransactionSql,
  token: string,
  lock: boolean,
): Promise<OpenInvite> {
  const [invite] = await sql<OpenInvite[]>`
    SELECT i.id, i.organization_id, o.name AS organization_name, i.email, i.role, u.id AS user_id
    FROM invites i
    JOIN organizations o ON o.id = i.organization_id AND o.suspended_at IS NULL
    LEFT JOIN users u ON u.email = i.email
    WHERE i.token_hash = ${hashSessionToken(token)}
      AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
    ${lock ? sql`FOR UPDATE OF i` : sql``}`;
  if (!invite) throw invalid();
  return invite;
}

/** Public preview (`POST /auth/accept-invite/preview`): what the accept form needs to show. */
export async function previewInvite(sql: Sql, token: string): Promise<InvitePreview> {
  const invite = await findOpenInvite(sql, token, false);
  return {
    organizationName: invite.organizationName,
    email: invite.email,
    role: invite.role,
    accountExists: invite.userId !== null,
  };
}
