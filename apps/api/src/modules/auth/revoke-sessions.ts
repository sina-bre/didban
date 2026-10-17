import type postgres from "postgres";

/**
 * Spec §11 "rotate the session ID on privilege change". When the changed user is not the one
 * making the request we cannot hand them a new cookie, so every session of theirs is revoked and
 * the next login issues a fresh ID. Runs inside the caller's transaction (ADR 0018).
 */
export async function revokeAllSessions(
  tx: postgres.TransactionSql | postgres.Sql,
  userId: string,
): Promise<void> {
  await tx`DELETE FROM auth_sessions WHERE user_id = ${userId}`;
}
