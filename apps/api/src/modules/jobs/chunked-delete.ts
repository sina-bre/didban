import { setTimeout as sleep } from "node:timers/promises";
import type postgres from "postgres";
import type { Sql } from "../../db/db.module.js";

// Spec §9.4: bounded chunks (default 10 000 rows per statement) with a short pause between, so a
// large delete never holds locks or I/O for long and ingestion keeps its latency.

export type JobContext = {
  sql: Sql;
  chunk: number;
  pauseMs: number;
  /** True once shutdown began: the job stops before its next chunk and resumes on a later run. */
  stopping: () => boolean;
};

export class JobStopped extends Error {
  constructor() {
    super("stopped for shutdown");
  }
}

type Tx = Sql | postgres.TransactionSql;

/** Repeats `step` (one chunk, returns its row count) until a chunk comes back short. */
export async function untilShort(ctx: JobContext, step: () => Promise<number>): Promise<number> {
  let total = 0;
  for (;;) {
    if (ctx.stopping()) throw new JobStopped();
    const rows = await step();
    total += rows;
    if (rows < ctx.chunk) return total;
    await sleep(ctx.pauseMs);
  }
}

/** Deletes up to `chunk` of the project's events matching `where`; returns their visit IDs. */
export async function deleteEventChunk(
  tx: Tx,
  projectId: string,
  where: postgres.Fragment,
  chunk: number,
): Promise<(string | null)[]> {
  const rows = await tx<{ visitId: string | null }[]>`
    WITH doomed AS (
      SELECT event_id FROM events WHERE project_id = ${projectId} AND ${where} LIMIT ${chunk}
    )
    DELETE FROM events e USING doomed d
    WHERE e.project_id = ${projectId} AND e.event_id = d.event_id
    RETURNING e.visit_id`;
  return rows.map((row) => row.visitId);
}

/** Deletes up to `chunk` of the project's visits matching `where`; returns the count. */
export async function deleteVisitChunk(
  tx: Tx,
  projectId: string,
  where: postgres.Fragment,
  chunk: number,
): Promise<number> {
  const result = await tx`
    WITH doomed AS (
      SELECT visit_id FROM visits WHERE project_id = ${projectId} AND ${where} LIMIT ${chunk}
    )
    DELETE FROM visits v USING doomed d
    WHERE v.project_id = ${projectId} AND v.visit_id = d.visit_id`;
  return result.count;
}
