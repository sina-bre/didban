import type { AdminOrganizationListResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { assertPlatformAdmin } from "./platform-only.js";

type Row = Omit<
  AdminOrganizationListResponse["organizations"][number],
  "suspendedAt" | "createdAt"
> & {
  suspendedAt: Date | null;
  createdAt: Date;
};

/** Every organization with member, project and 30-day event counts (spec §11: counts only). */
export async function listAdminOrganizations(
  sql: Sql,
  actor: { isPlatformAdmin: boolean },
): Promise<AdminOrganizationListResponse> {
  assertPlatformAdmin(actor);
  const rows = await sql<Row[]>`
    SELECT o.id, o.name, o.slug, o.suspended_at, o.created_at, o.daily_event_quota,
      (SELECT count(*)::int FROM memberships m WHERE m.organization_id = o.id) AS members,
      (SELECT count(*)::int FROM projects p WHERE p.organization_id = o.id) AS projects,
      (SELECT coalesce(sum(u.events), 0)::float8 FROM project_usage_daily u
         JOIN projects p ON p.id = u.project_id
        WHERE p.organization_id = o.id
          AND u.day > (now() AT TIME ZONE 'UTC')::date - 30) AS events_last30_days
    FROM organizations o
    ORDER BY o.name, o.id`;
  return {
    organizations: rows.map((row) => ({
      ...row,
      suspendedAt: row.suspendedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
