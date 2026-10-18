import type { NewEvent, Tx, WriteTarget } from "./new-event.js";

// Spec §9.1 `pages_seen`: one bulk upsert per batch. Capped at 10 000 rows per project: past the
// cap, new routes are recorded under '/__other__' and counted. The cap is checked only when the
// batch has unseen routes, so the usual batch pays one indexed lookup. Concurrent batches can
// overshoot by a few rows (no lock), which a soft cap tolerates.

export const PAGES_SEEN_CAP = 10_000;
export const OTHER_ROUTE = "/__other__";

type Page = {
  hostname: string;
  route: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastTitle: string | null;
};

const keyOf = (page: { hostname: string; route: string }) => `${page.hostname}\n${page.route}`;

function merge(pages: Map<string, Page>, page: Page): void {
  const known = pages.get(keyOf(page));
  if (!known) return void pages.set(keyOf(page), { ...page });
  if (page.firstSeenAt < known.firstSeenAt) known.firstSeenAt = page.firstSeenAt;
  if (page.lastSeenAt >= known.lastSeenAt) {
    known.lastSeenAt = page.lastSeenAt;
    known.lastTitle = page.lastTitle ?? known.lastTitle;
  }
}

async function unseen(tx: Tx, target: WriteTarget, pages: Page[]): Promise<Set<string>> {
  const rows = await tx<{ hostname: string; route: string }[]>`
    SELECT hostname, route FROM pages_seen
    WHERE project_id = ${target.projectId} AND environment_id = ${target.environmentId}
      AND (hostname, route) IN (SELECT * FROM unnest(${pages.map((p) => p.hostname)}::text[],
                                                     ${pages.map((p) => p.route)}::text[]))`;
  const seen = new Set(rows.map(keyOf));
  return new Set(pages.map(keyOf).filter((key) => !seen.has(key)));
}

async function room(tx: Tx, target: WriteTarget): Promise<number> {
  const [row] = await tx<{ count: number }[]>`
    SELECT count(*)::int AS count FROM pages_seen WHERE project_id = ${target.projectId}`;
  return Math.max(0, PAGES_SEEN_CAP - (row?.count ?? 0));
}

/** Returns how many new routes were folded into '/__other__'. */
export async function upsertPagesSeen(tx: Tx, target: WriteTarget, events: readonly NewEvent[]) {
  const pages = new Map<string, Page>();
  for (const e of events) {
    const at = e.occurredAt;
    merge(pages, {
      hostname: e.hostname,
      route: e.route,
      firstSeenAt: at,
      lastSeenAt: at,
      lastTitle: e.title,
    });
  }
  if (pages.size === 0) return 0;
  const fresh = await unseen(tx, target, [...pages.values()]);
  let free = fresh.size > 0 ? await room(tx, target) : 0;
  const rows = new Map<string, Page>();
  let overflowed = 0;
  for (const [key, page] of pages) {
    const fits = !fresh.has(key) || page.route === OTHER_ROUTE || free-- > 0;
    if (!fits) overflowed += 1;
    merge(rows, fits ? page : { ...page, route: OTHER_ROUTE });
  }
  const values = [...rows.values()]
    .map((page) => ({ ...page, projectId: target.projectId, environmentId: target.environmentId }))
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b))); // stable lock order across requests
  await tx`
    INSERT INTO pages_seen ${tx(values)}
    ON CONFLICT (project_id, environment_id, hostname, route) DO UPDATE SET
      first_seen_at = LEAST(pages_seen.first_seen_at, excluded.first_seen_at),
      last_seen_at = GREATEST(pages_seen.last_seen_at, excluded.last_seen_at),
      last_title = CASE WHEN excluded.last_seen_at >= pages_seen.last_seen_at
        THEN COALESCE(excluded.last_title, pages_seen.last_title) ELSE pages_seen.last_title END`;
  return overflowed;
}
