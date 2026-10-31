import type { AdminInstanceResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { assertPlatformAdmin } from "./platform-only.js";

type Counts = AdminInstanceResponse["counts"] & { postgres: string; databaseBytes: number };

/** Instance health for the operator (spec §11): runtime, database size, totals, GeoIP on/off. */
export async function instanceHealth(
  sql: Sql,
  input: { actor: { isPlatformAdmin: boolean }; geoIp: boolean },
): Promise<AdminInstanceResponse> {
  assertPlatformAdmin(input.actor);
  const [row] = await sql<Counts[]>`
    SELECT current_setting('server_version') AS postgres,
      pg_database_size(current_database())::float8 AS database_bytes,
      (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM projects) AS projects,
      (SELECT coalesce(sum(events), 0)::float8 FROM project_usage_daily
        WHERE day = (now() AT TIME ZONE 'UTC')::date) AS events_today`;
  if (!row) throw new Error("no instance row");
  const { postgres, databaseBytes, ...counts } = row;
  return {
    node: process.version,
    postgres,
    uptimeSeconds: Math.round(process.uptime()),
    databaseBytes,
    geoIp: input.geoIp,
    counts,
  };
}
