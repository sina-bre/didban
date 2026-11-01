import type postgres from "postgres";
import { dayWindows, deleteVisitChunk, type JobContext } from "./chunked-delete.js";
import {
  chunks,
  type DeletionRequest,
  eachWindow,
  type Tx,
  WINDOW_MS,
} from "./deletion-windows.js";

// Spec §12 deletion by range / visitor / user ID. Events are scanned one day window at a time over
// `events_range_idx` (bounded statements, no extra index on hot ingest columns); `cursor_at` saves
// finished windows, so a restart resumes. Visits go last, so a resumed run still finds them.

type Step = (ctx: JobContext, request: DeletionRequest) => Promise<void>;

const range: Step = async (ctx, request) => {
  const [from, to] = [request.fromAt as Date, request.toAt as Date];
  await eachWindow(
    ctx,
    request,
    [from, to],
    (tx, a, b) => tx`occurred_at >= ${a} AND occurred_at < ${b}`,
  );
  for (const [a, b] of dayWindows(from, to)) {
    await visitChunks(ctx, request, (tx) => tx`started_at >= ${a} AND started_at < ${b}`);
  }
};

const visitor: Step = async (ctx, request) => {
  const id = request.visitorId as Buffer;
  await eachWindow(
    ctx,
    request,
    await projectSpan(ctx, request.projectId),
    (tx, a, b) => tx`occurred_at >= ${a} AND occurred_at < ${b} AND visitor_id = ${id}`,
  );
  await visitChunks(ctx, request, (tx) => tx`visitor_id = ${id}`);
};

/** Events carrying the user ID, plus the rest of the visits they belong to. */
const user: Step = async (ctx, request) => {
  const id = request.userId as string;
  const where = (tx: Tx, a: Date, b: Date) =>
    tx`occurred_at >= ${a} AND occurred_at < ${b} AND user_id = ${id}`;
  await eachWindow(ctx, request, await projectSpan(ctx, request.projectId), where, true);
};

const STEPS: Record<DeletionRequest["kind"], Step> = { range, visitor, user };

export function runDeletionSteps(ctx: JobContext, request: DeletionRequest): Promise<void> {
  return STEPS[request.kind](ctx, request);
}

function visitChunks(
  ctx: JobContext,
  request: DeletionRequest,
  where: (tx: Tx) => postgres.Fragment,
) {
  return chunks(ctx, request, async (tx) => {
    const visits = await deleteVisitChunk(tx, request.projectId, where(tx), ctx.chunk);
    return { matched: visits, events: 0, visits };
  });
}

/** Oldest event of the project to one day past now (allowed clock skew). */
async function projectSpan({ sql }: JobContext, projectId: string): Promise<[Date, Date]> {
  const [row] = await sql<{ oldest: Date | null }[]>`
    SELECT min(occurred_at) AS oldest FROM events WHERE project_id = ${projectId}`;
  const end = new Date(Date.now() + WINDOW_MS);
  return [row?.oldest ?? end, end];
}
