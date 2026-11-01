import type postgres from "postgres";
import { dayWindows, deleteEventChunk, type JobContext, untilShort } from "./chunked-delete.js";

// The shared mechanics of a deletion request: one-day windows over `events_range_idx` with the
// cursor saved after each window, and chunks that commit together with the request's counters.

export const WINDOW_MS = 86_400_000;

export type DeletionRequest = {
  id: string;
  projectId: string;
  kind: "range" | "visitor" | "user";
  fromAt: Date | null;
  toAt: Date | null;
  visitorId: Buffer | null;
  userId: string | null;
  cursorAt: Date | null;
};

export type Tx = postgres.TransactionSql;
type Counts = { matched: number; events: number; visits: number };
type VisitBounds = { visitId: string; environmentId: string; startedAt: Date; lastSeenAt: Date };
type Where = (tx: Tx, from: Date, to: Date) => postgres.Fragment;

/** Day windows from the cursor to the end, per environment; `wholeVisits`: their visits too. */
export async function eachWindow(
  ctx: JobContext,
  request: DeletionRequest,
  [start, end, environments]: [Date, Date, string[]],
  where: Where,
  wholeVisits = false,
) {
  const resume = request.cursorAt && request.cursorAt > start ? request.cursorAt : start;
  for (const [from, to] of dayWindows(resume, end)) {
    for (const env of environments) {
      await envChunks(
        ctx,
        request,
        (tx) => tx`environment_id = ${env} AND ${where(tx, from, to)}`,
        wholeVisits,
      );
    }
    await ctx.sql`UPDATE data_deletions SET cursor_at = ${to} WHERE id = ${request.id}`;
  }
}

function envChunks(
  ctx: JobContext,
  request: DeletionRequest,
  where: (tx: Tx) => postgres.Fragment,
  wholeVisits: boolean,
) {
  return chunks(ctx, request, async (tx) => {
    const visitIds = await deleteEventChunk(tx, request.projectId, where(tx), ctx.chunk);
    const rest = wholeVisits
      ? await deleteWholeVisits(tx, request.projectId, visitIds)
      : { events: 0, visits: 0 };
    return {
      matched: visitIds.length,
      events: visitIds.length + rest.events,
      visits: rest.visits,
    };
  });
}

/** Repeats one chunk until it comes back short; each chunk commits with the request's counters. */
export function chunks(
  ctx: JobContext,
  request: DeletionRequest,
  step: (tx: Tx) => Promise<Counts>,
) {
  return untilShort(ctx, () =>
    ctx.sql.begin(async (tx) => {
      const counts = await step(tx);
      await tx`
        UPDATE data_deletions SET events_deleted = events_deleted + ${counts.events},
               visits_deleted = visits_deleted + ${counts.visits}
        WHERE id = ${request.id}`;
      return counts.matched;
    }),
  );
}

/** The rest of each visit (page views before `identify`) and the visit rows themselves. */
async function deleteWholeVisits(tx: Tx, projectId: string, ids: (string | null)[]) {
  const visitIds = [...new Set(ids.filter((id): id is string => id !== null))];
  if (visitIds.length === 0) return { events: 0, visits: 0 };
  const visits = await tx<VisitBounds[]>`
    DELETE FROM visits WHERE project_id = ${projectId} AND visit_id = ANY(${visitIds}::uuid[])
    RETURNING visit_id, environment_id, started_at, last_seen_at`;
  // One `events_range_idx` range per visit, with its bounds as values: any join (also LATERAL)
  // was planned as a hash join over a sequential scan of the project (10–27 s on 8 M events).
  let events = 0;
  for (const v of visits) {
    const result = await tx`
      DELETE FROM events WHERE project_id = ${projectId} AND environment_id = ${v.environmentId}
        AND occurred_at BETWEEN ${v.startedAt} AND ${v.lastSeenAt} AND visit_id = ${v.visitId}`;
    events += result.count;
  }
  return { events, visits: visits.length };
}
