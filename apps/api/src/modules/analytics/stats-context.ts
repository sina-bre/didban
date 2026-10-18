import type { IdentityModeMeta, StatsInterval, StatsMeta, StatsQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { bucketsFit, chooseInterval, previousRange, type Range } from "../../domain/stats-range.js";
import { AppError, notFound } from "../../http/app-error.js";
import { projectInScope } from "../access/in-scope.js";

// Everything a stats query needs besides SQL: the project's reporting time zone, the environments
// it reads (all of the project, or the one asked for), the interval and the comparison range.

export type StatsContext = {
  projectId: string;
  environmentIds: string[];
  timezone: string;
  interval: StatsInterval;
  range: Range;
  previous: Range | null;
  query: StatsQuery;
  identityMode: IdentityModeMeta;
};

type EnvRow = { id: string; identityMode: "cookieless" | "persistent" };

export async function loadStatsContext(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: StatsQuery },
): Promise<StatsContext> {
  const projectId = projectInScope(scope, input.projectId);
  const { query } = input;
  const [project] = await sql<{ reportingTimezone: string }[]>`
    SELECT reporting_timezone FROM projects WHERE id = ${projectId} AND archived_at IS NULL`;
  if (!project) throw notFound();
  const all = await sql<EnvRow[]>`
    SELECT id, identity_mode FROM environments WHERE project_id = ${projectId} ORDER BY id`;
  const envs = query.environmentId ? all.filter((e) => e.id === query.environmentId) : all;
  if (query.environmentId && envs.length === 0) throw notFound();
  const range = { from: query.from, to: query.to };
  const interval = chooseInterval(query.interval, range);
  if (!bucketsFit(interval, range)) {
    throw new AppError(400, "VALIDATION_FAILED", "Too many buckets: choose a coarser interval");
  }
  const modes = new Set(envs.map((e) => e.identityMode));
  return {
    projectId,
    environmentIds: envs.map((e) => e.id),
    timezone: project.reportingTimezone,
    interval,
    range,
    previous: previousRange(query.compare, range),
    query,
    identityMode:
      modes.size === 1 ? ([...modes][0] ?? "cookieless") : modes.size ? "mixed" : "cookieless",
  };
}

export function statsMeta(context: StatsContext): StatsMeta {
  const { range, previous } = context;
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    interval: context.interval,
    timezone: context.timezone,
    compare: context.query.compare,
    previous: previous && { from: previous.from.toISOString(), to: previous.to.toISOString() },
    identityMode: context.identityMode,
    truncated: false,
    generatedAt: new Date().toISOString(),
  };
}
