import postgres from "postgres";

// Reads what the real API committed to the local test DB (seeded by seed-e2e.mjs).
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. Run `pnpm db:setup`.");
const sql = postgres(url, { max: 1, idle_timeout: 1, onnotice: () => {} });

export interface StoredEvent {
  type: number; // 1 page, 2 track (packages/contracts EVENT_TYPES)
  name: string | null;
  pathname: string;
  source: number; // 1 browser, 2 server
  visitId: string | null;
  revenue: string | null;
  currency: string | null;
}

/** Events of one e2e project received since `since`, oldest first. */
export function storedEvents(slug: string, since: Date): Promise<StoredEvent[]> {
  return sql<StoredEvent[]>`
    SELECT e.type, e.name, e.pathname, e.source, e.visit_id AS "visitId",
           e.revenue::text AS revenue, e.currency
    FROM events e JOIN projects p ON p.id = e.project_id
    WHERE p.slug = ${slug} AND e.received_at >= ${since}
    ORDER BY e.occurred_at, e.event_id`;
}

export const storedPagePaths = (list: StoredEvent[]) =>
  list.filter((e) => e.type === 1).map((e) => e.pathname);

/** The id the seed gave an e2e project (dashboard URLs need it). */
export async function projectIdOf(slug: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`SELECT id FROM projects WHERE slug = ${slug}`;
  if (!row) throw new Error(`no e2e project ${slug}`);
  return row.id;
}
