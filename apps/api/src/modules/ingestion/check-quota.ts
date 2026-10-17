import type { Sql } from "../../db/db.module.js";

// Spec §7 step 4: the organization's daily event quota (NULL = unlimited) against today's (UTC)
// usage of all its projects. One indexed read per batch; the counters are written in step 8.

export async function isOverQuota(sql: Sql, organizationId: string): Promise<boolean> {
  const [row] = await sql<{ over: boolean }[]>`
    SELECT o.daily_event_quota IS NOT NULL AND o.daily_event_quota <= (
      SELECT coalesce(sum(u.events), 0)
      FROM project_usage_daily u JOIN projects p ON p.id = u.project_id
      WHERE p.organization_id = o.id AND u.day = (now() AT TIME ZONE 'UTC')::date
    ) AS over
    FROM organizations o WHERE o.id = ${organizationId}`;
  return row?.over ?? false;
}
