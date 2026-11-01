import {
  dayWindows,
  deleteEventChunk,
  deleteVisitChunk,
  type JobContext,
  untilShort,
} from "./chunked-delete.js";

// Spec §9.4 nightly retention: expired events in chunks, then expired visits, then expired auth
// sessions. Also the 14-day diagnostics window (catalog 23.2). Archived projects are included:
// archiving hides a project, it does not extend how long its data is kept.

const DAY_MS = 86_400_000;
const SESSION_IDLE = "7 days"; // auth-session.repository.ts: idle timeout
const DIAGNOSTICS_DAYS = 14;

type Project = { id: string; retentionDays: number; events: Date | null; visits: Date | null };

/** Returns the number of rows deleted. */
export async function runRetention(ctx: JobContext, now = new Date()): Promise<number> {
  const { sql } = ctx;
  // Oldest row per table: where the day windows start.
  const projects = await sql<Project[]>`
    SELECT p.id, p.retention_days,
           (SELECT min(occurred_at) FROM events e WHERE e.project_id = p.id) AS events,
           (SELECT min(started_at) FROM visits v WHERE v.project_id = p.id) AS visits
    FROM projects p WHERE p.retention_days IS NOT NULL ORDER BY p.id`;
  let rows = 0;
  for (const project of projects) {
    const cutoff = new Date(now.getTime() - project.retentionDays * DAY_MS);
    for (const [a, b] of dayWindows(project.events ?? cutoff, cutoff)) {
      const where = sql`occurred_at >= ${a} AND occurred_at < ${b}`;
      rows += await untilShort(
        ctx,
        async () => (await deleteEventChunk(sql, project.id, where, ctx.chunk)).length,
      );
    }
    for (const [a, b] of dayWindows(project.visits ?? cutoff, cutoff)) {
      const where = sql`started_at >= ${a} AND started_at < ${b}`;
      rows += await untilShort(ctx, () => deleteVisitChunk(sql, project.id, where, ctx.chunk));
    }
  }
  return rows + (await expireHousekeeping(ctx, now));
}

/** Small tables: one statement each. */
async function expireHousekeeping({ sql }: JobContext, now: Date): Promise<number> {
  const sessions = await sql`
    DELETE FROM auth_sessions
    WHERE expires_at <= ${now} OR last_seen_at <= ${now}::timestamptz - ${SESSION_IDLE}::interval`;
  const since = new Date(now.getTime() - DIAGNOSTICS_DAYS * DAY_MS);
  const diagnostics = await sql`DELETE FROM ingestion_diagnostics WHERE hour < ${since}`;
  const origins = await sql`
    DELETE FROM ingestion_rejected_origins WHERE day < ${since.toISOString().slice(0, 10)}::date`;
  return sessions.count + diagnostics.count + origins.count;
}
