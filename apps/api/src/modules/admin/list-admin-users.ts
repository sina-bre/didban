import type { AdminUserListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { assertPlatformAdmin } from "./platform-only.js";

type Row = Omit<AdminUserListResponse["users"][number], "createdAt"> & { createdAt: Date };

/** Every account: email, flags and how many organizations it belongs to. No hashes, no sessions. */
export async function listAdminUsers(
  sql: Sql,
  actor: { isPlatformAdmin: boolean },
): Promise<AdminUserListResponse> {
  assertPlatformAdmin(actor);
  const rows = await sql<Row[]>`
    SELECT u.id, u.email, u.is_platform_admin, u.must_change_password, u.created_at,
      (SELECT count(*)::int FROM memberships m WHERE m.user_id = u.id) AS organizations
    FROM users u
    ORDER BY u.email`;
  return { users: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
}
