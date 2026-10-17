import type { Sql } from "../../db/db.module.js";
import { recordAudit } from "../audit/record-audit.js";

/**
 * Logout revokes this session; "log out everywhere" revokes every session of the user (spec §11).
 * The revocation and its audit row commit together.
 */
export async function logout(
  sql: Sql,
  session: { sessionId: string; userId: string },
  everywhere: boolean,
): Promise<void> {
  await sql.begin(async (tx) => {
    if (everywhere) await tx`DELETE FROM auth_sessions WHERE user_id = ${session.userId}`;
    else await tx`DELETE FROM auth_sessions WHERE id = ${session.sessionId}`;
    await recordAudit(tx, {
      action: everywhere ? "auth.sessions_revoked" : "auth.logout",
      actorUserId: session.userId,
      target: { type: "user", id: session.userId },
    });
  });
}
