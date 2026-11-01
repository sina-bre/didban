import type { Sql } from "../../db/db.module.js";

// Every event statement of a job names one environment: `events_range_idx` is
// (project_id, environment_id, occurred_at), and without the middle column a day window or a
// min() scanned the whole project (11–13 s on 8 M events, close to the 15 s statement timeout).

export type EventSpan = { environments: string[]; oldest: Date | null };

/** The project's environments and its oldest event: one index lookup per environment. */
export async function eventSpan(sql: Sql, projectId: string): Promise<EventSpan> {
  const rows = await sql<{ id: string; oldest: Date | null }[]>`
    SELECT n.id, (SELECT min(occurred_at) FROM events e
                  WHERE e.project_id = ${projectId} AND e.environment_id = n.id) AS oldest
    FROM environments n WHERE n.project_id = ${projectId} ORDER BY n.id`;
  const times = rows.flatMap((row) => (row.oldest ? [row.oldest.getTime()] : []));
  return {
    environments: rows.map((row) => row.id),
    oldest: times.length > 0 ? new Date(Math.min(...times)) : null,
  };
}
