import type { Sql } from "../../db/db.module.js";

// `job_runs` (spec §15 "job last-success timestamps"): one row per job, written around each run.
export type JobName = "retention" | "data_deletion";

/** Runs `work`, records start, rows, duration and success or error. Rethrows the error. */
export async function recordRun(sql: Sql, job: JobName, work: () => Promise<number>) {
  const started = Date.now();
  await sql`
    INSERT INTO job_runs (job, last_started_at) VALUES (${job}, now())
    ON CONFLICT (job) DO UPDATE SET last_started_at = now()`;
  try {
    const rows = await work();
    await sql`
      UPDATE job_runs SET last_success_at = now(), last_error = NULL, last_rows = ${rows},
             last_duration_ms = ${Date.now() - started}
      WHERE job = ${job}`;
    return rows;
  } catch (error) {
    await sql`
      UPDATE job_runs SET last_error = ${(error as Error).message.slice(0, 500)},
             last_duration_ms = ${Date.now() - started}
      WHERE job = ${job}`;
    throw error;
  }
}

/** True when `job` has no success in the last `hours` hours. */
export async function isDue(sql: Sql, job: JobName, hours: number): Promise<boolean> {
  const [row] = await sql<{ due: boolean }[]>`
    SELECT NOT EXISTS (
      SELECT 1 FROM job_runs
      WHERE job = ${job} AND last_success_at > now() - make_interval(hours => ${hours})
    ) AS due`;
  return row?.due ?? true;
}
