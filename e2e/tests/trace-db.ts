import { sql } from "./db.js";

// The numbers the dashboard must show, counted straight from the rows the API persisted
// (spec §4: visitors = distinct visitor IDs, visits = distinct visits, page views = page events).
// Browser events only: the trace spec sends no server events.

export async function projectIdByName(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM projects WHERE name = ${name}`;
  if (!row) throw new Error(`no project named ${name}`);
  return row.id;
}

export interface Totals {
  visitors: number;
  visits: number;
  pageviews: number;
  events: number;
}

export async function totals(projectId: string): Promise<Totals> {
  const [row] = await sql<Totals[]>`
    SELECT count(DISTINCT visitor_id)::int AS visitors, count(DISTINCT visit_id)::int AS visits,
           (count(*) FILTER (WHERE type = 1))::int AS pageviews, count(*)::int AS events
    FROM events WHERE project_id = ${projectId}`;
  if (!row) throw new Error("no totals");
  return row;
}

export type PageCount = { route: string; visitors: number; pageviews: number };

export function pageCounts(projectId: string): Promise<PageCount[]> {
  return sql<PageCount[]>`
    SELECT route, count(DISTINCT visitor_id)::int AS visitors, count(*)::int AS pageviews
    FROM events WHERE project_id = ${projectId} AND type = 1
    GROUP BY route ORDER BY route`;
}

export type ReferrerCount = { referrer: string | null; visitors: number; visits: number };

/** First touch per visit, as the Sources report counts it. */
export function referrerCounts(projectId: string): Promise<ReferrerCount[]> {
  return sql<ReferrerCount[]>`
    SELECT referrer_source AS referrer, count(DISTINCT visitor_id)::int AS visitors,
           count(*)::int AS visits
    FROM visits WHERE project_id = ${projectId}
    GROUP BY referrer_source ORDER BY referrer_source NULLS FIRST`;
}
