import { type JobContext, JobStopped } from "./chunked-delete.js";
import { runDeletionSteps } from "./deletion-steps.js";
import type { DeletionRequest } from "./deletion-windows.js";

// Works through open deletion requests, oldest first. A request interrupted by shutdown stays
// `running` and resumes from its cursor; any other error marks it `failed` with the message (the
// operator can ask again) so one bad request never blocks the queue.

/** Returns the number of rows deleted in this run. */
export async function runDeletions(ctx: JobContext): Promise<number> {
  let rows = 0;
  for (;;) {
    if (ctx.stopping()) throw new JobStopped();
    const request = await claimNext(ctx);
    if (!request) return rows;
    try {
      await runDeletionSteps(ctx, request);
      rows += await finish(ctx, request.id, "done", null);
    } catch (error) {
      if (error instanceof JobStopped) throw error;
      await finish(ctx, request.id, "failed", (error as Error).message.slice(0, 500));
    }
  }
}

async function claimNext({ sql }: JobContext): Promise<DeletionRequest | undefined> {
  const [row] = await sql<DeletionRequest[]>`
    UPDATE data_deletions SET status = 'running', started_at = coalesce(started_at, now())
    WHERE id = (
      SELECT id FROM data_deletions WHERE status IN ('pending', 'running')
      ORDER BY created_at LIMIT 1
    )
    RETURNING id, project_id, kind, from_at, to_at, visitor_id, user_id, cursor_at`;
  return row;
}

async function finish(
  { sql }: JobContext,
  id: string,
  status: "done" | "failed",
  error: string | null,
): Promise<number> {
  const [row] = await sql<{ rows: string }[]>`
    UPDATE data_deletions SET status = ${status}, error = ${error}, finished_at = now()
    WHERE id = ${id}
    RETURNING events_deleted + visits_deleted AS rows`;
  return Number(row?.rows ?? 0);
}
