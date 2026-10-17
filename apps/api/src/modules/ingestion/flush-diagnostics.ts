import type { Sql } from "../../db/db.module.js";
import { type DrainedDiagnostics, MAX_ORIGINS_PER_DAY } from "./ingest-diagnostics.js";

// Two bulk upserts per flush. The origin cap is checked against what is already stored for the
// day; two processes flushing at the same moment may overshoot it slightly (ADR 0025).

export async function flushDiagnostics(sql: Sql, { counters, origins }: DrainedDiagnostics) {
  if (counters.length > 0) {
    const col = <K extends keyof (typeof counters)[number]>(k: K) => counters.map((row) => row[k]);
    await sql`
      INSERT INTO ingestion_diagnostics (project_id, environment_id, hour, code, count)
      SELECT * FROM unnest(${col("projectId")}::uuid[], ${col("environmentId")}::uuid[],
                           ${col("hour")}::timestamptz[], ${col("code")}::text[], ${col("count")}::int[])
      ON CONFLICT (environment_id, hour, code)
      DO UPDATE SET count = ingestion_diagnostics.count + excluded.count`;
  }
  if (origins.length === 0) return;
  const col = <K extends keyof (typeof origins)[number]>(k: K) => origins.map((row) => row[k]);
  await sql`
    WITH v AS (
      SELECT * FROM unnest(${col("projectId")}::uuid[], ${col("environmentId")}::uuid[],
                           ${col("day")}::date[], ${col("origin")}::text[], ${col("count")}::int[],
                           ${col("lastSeenAt")}::timestamptz[])
        AS v(project_id, environment_id, day, origin, count, last_seen_at)
    ), checked AS (
      SELECT v.*,
        EXISTS (SELECT 1 FROM ingestion_rejected_origins r
                WHERE r.environment_id = v.environment_id AND r.day = v.day AND r.origin = v.origin) AS known,
        (SELECT count(*) FROM ingestion_rejected_origins r
         WHERE r.environment_id = v.environment_id AND r.day = v.day) AS stored
      FROM v
    ), numbered AS (
      SELECT checked.*,
        row_number() OVER (PARTITION BY environment_id, day, known ORDER BY count DESC) AS n
      FROM checked
    )
    INSERT INTO ingestion_rejected_origins (project_id, environment_id, day, origin, count, last_seen_at)
    SELECT project_id, environment_id, day, origin, count, last_seen_at FROM numbered
    WHERE known OR stored + n <= ${MAX_ORIGINS_PER_DAY}
    ON CONFLICT (environment_id, day, origin) DO UPDATE
    SET count = ingestion_rejected_origins.count + excluded.count,
        last_seen_at = greatest(ingestion_rejected_origins.last_seen_at, excluded.last_seen_at)`;
}
