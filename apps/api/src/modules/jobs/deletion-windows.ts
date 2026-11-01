import type postgres from "postgres";
import { deleteEventChunk, type JobContext, untilShort } from "./chunked-delete.js";

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
type Where = (tx: Tx, from: Date, to: Date) => postgres.Fragment;

/** Day windows from the saved cursor to the end; `wholeVisits` also removes the matched visits. */
export async function eachWindow(
  ctx: JobContext,
  request: DeletionRequest,
  [start, end]: [Date, Date],
  where: Where,
  wholeVisits = false,
) {
  let cursor = request.cursorAt && request.cursorAt > start ? request.cursorAt : start;
  while (cursor < end) {
    const [from, to] = [cursor, new Date(Math.min(cursor.getTime() + WINDOW_MS, end.getTime()))];
    await chunks(ctx, request, async (tx) => {
      const visitIds = await deleteEventChunk(
        tx,
        request.projectId,
        where(tx, from, to),
        ctx.chunk,
      );
      const rest = wholeVisits
        ? await deleteWholeVisits(tx, request.projectId, visitIds)
        : { events: 0, visits: 0 };
      return {
        matched: visitIds.length,
        events: visitIds.length + rest.events,
        visits: rest.visits,
      };
    });
    await ctx.sql`UPDATE data_deletions SET cursor_at = ${to} WHERE id = ${request.id}`;
    cursor = to;
  }
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
  const events = await tx`
    DELETE FROM events e USING visits v
    WHERE v.project_id = ${projectId} AND v.visit_id = ANY(${visitIds}::uuid[])
      AND e.project_id = ${projectId} AND e.visit_id = v.visit_id
      AND e.occurred_at BETWEEN v.started_at AND v.last_seen_at`;
  const visits = await tx`
    DELETE FROM visits WHERE project_id = ${projectId} AND visit_id = ANY(${visitIds}::uuid[])`;
  return { events: events.count, visits: visits.count };
}
