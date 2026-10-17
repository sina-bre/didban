import type { Invite } from "@didban/contracts";
import type postgres from "postgres";

/** `SELECT ${INVITE_SELECT(sql)} FROM invites i`: the contract fields with a computed status. */
export const INVITE_SELECT = (sql: postgres.Sql | postgres.TransactionSql) => sql`
  i.id, i.email, i.role, i.created_at, i.expires_at,
  CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
       WHEN i.revoked_at IS NOT NULL THEN 'revoked'
       WHEN i.expires_at <= now() THEN 'expired'
       ELSE 'pending' END AS status`;

export type InviteRow = Omit<Invite, "createdAt" | "expiresAt"> & {
  createdAt: Date;
  expiresAt: Date;
};

export const toInvite = (row: InviteRow): Invite => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
});

/** One answer for unknown, expired, used, revoked or suspended: the error says nothing. */
export const INVALID_INVITE = { status: 400, code: "INVITE_INVALID", message: "Invalid invite" };
