import type { GoalStats, GoalStatsResponse, StatsQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { parseRouteTemplate, templateRegex } from "../../domain/route-template.js";
import { goalRows, toGoal } from "../goals/goal-row.js";
import { readStats } from "./read-stats.js";
import { eventScope } from "./scope-sql.js";
import { loadStatsContext, statsMeta } from "./stats-context.js";

// `GET …/stats/goals` (spec §4): conversions and revenue count matching events of both sources;
// the conversion rate is browser visitors with ≥ 1 match ÷ browser visitors, same range and
// filters. Revenue is grouped by currency, never summed across currencies, never converted.
// Page goals match `pathname` with the template's anchored regex (bound, see templateRegex).

type Counts = { goalId: string; conversions: number; visitors: number };
type Revenue = { goalId: string; currency: string; amount: string };

export function getGoalStats(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: StatsQuery },
): Promise<GoalStatsResponse> {
  return readStats(sql, async (tx) => {
    const context = await loadStatsContext(tx, scope, input);
    const goals = await goalRows(tx, context.projectId);
    const meta = statsMeta(context);
    if (goals.length === 0) return { meta, goals: [] };
    const regex = goals.map((g) => {
      const template = g.pathPattern ? parseRouteTemplate(g.pathPattern) : null;
      return template ? templateRegex(template) : null;
    });
    const scopeSql = eventScope(tx, context, context.range);
    const matches = tx`
      FROM unnest(${goals.map((g) => g.id)}::uuid[], ${goals.map((g) => g.kind)}::text[],
                  ${goals.map((g) => g.eventName)}::text[], ${regex}::text[]) AS g(id, kind, event_name, regex)
      JOIN events e ON ${scopeSql} AND (
        (g.kind = 'event' AND e.type = 2 AND e.name = g.event_name) OR
        (g.kind = 'page' AND e.type = 1 AND e.pathname ~ g.regex))`;
    const counts = await tx<Counts[]>`
      SELECT goal_id, sum(n)::int AS conversions, count(*) FILTER (WHERE browser)::int AS visitors
      FROM (SELECT g.id AS goal_id, e.visitor_id, e.source = 1 AS browser, count(*) AS n
            ${matches} GROUP BY 1, 2, 3) AS x
      GROUP BY 1`;
    const revenue = await tx<Revenue[]>`
      SELECT g.id AS goal_id, e.currency, sum(e.revenue)::text AS amount
      ${matches} AND e.revenue IS NOT NULL GROUP BY g.id, e.currency ORDER BY e.currency`;
    const [total] = await tx<{ visitors: number }[]>`
      SELECT count(*)::int AS visitors
      FROM (SELECT e.visitor_id FROM events e WHERE ${scopeSql} AND e.source = 1 GROUP BY 1) AS v`;
    const all = total?.visitors ?? 0;
    const stats: GoalStats[] = goals.map((goal) => {
      const c = counts.find((row) => row.goalId === goal.id);
      const visitors = c?.visitors ?? 0;
      return {
        ...toGoal(goal),
        conversions: c?.conversions ?? 0,
        visitors,
        conversionRate: all === 0 ? null : Number((visitors / all).toFixed(4)),
        revenue: revenue
          .filter((r) => r.goalId === goal.id)
          .map(({ currency, amount }) => ({ currency, amount })),
      };
    });
    return { meta, goals: stats };
  });
}
