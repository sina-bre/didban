import {
  type BreakdownResponse,
  EVENT_NAME_PATTERN,
  type EventPropertiesQuery,
  type EventRow,
  type EventsQuery,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { eventBreakdown, type Rows } from "./breakdown-sql.js";
import { type ReportInput, runReport } from "./report.js";
import { eventScope } from "./scope-sql.js";
import type { StatsContext } from "./stats-context.js";

// `GET …/stats/events` (custom events by name, both sources; visitors count browser events only)
// and `…/stats/events/:name/properties` (keys of that event, or the values of `?key=`).

export function getEvents(sql: Sql, scope: AccessScope, input: ReportInput<EventsQuery>) {
  return runReport(sql, scope, input, (tx, context, query) =>
    eventBreakdown(tx, context, {
      dimension: tx`e.name`,
      where: tx`e.type = 2`,
      limit: query.limit,
    }),
  ) as Promise<BreakdownResponse<EventRow>>;
}

async function propertyKeys(sql: Sql, context: StatsContext, name: string, limit: number) {
  const rows = await sql<EventRow[]>`
    SELECT k AS value,
           count(DISTINCT e.visitor_id) FILTER (WHERE e.source = 1)::int AS visitors,
           0 AS pageviews, count(*)::int AS events
    FROM events e CROSS JOIN LATERAL jsonb_object_keys(e.properties) AS k
    WHERE ${eventScope(sql, context, context.range)} AND e.type = 2 AND e.name = ${name}
    GROUP BY 1 ORDER BY events DESC, value LIMIT ${limit + 1}`;
  return { rows: rows.slice(0, limit), truncated: rows.length > limit } satisfies Rows<EventRow>;
}

export function getEventProperties(
  sql: Sql,
  scope: AccessScope,
  input: ReportInput<EventPropertiesQuery> & { name: string },
): Promise<BreakdownResponse<EventRow>> {
  if (!EVENT_NAME_PATTERN.test(input.name)) {
    throw new AppError(400, "VALIDATION_FAILED", "Invalid event name");
  }
  return runReport(sql, scope, input, (tx, context, query) => {
    if (!query.key) return propertyKeys(tx, context, input.name, query.limit);
    return eventBreakdown(tx, context, {
      dimension: tx`(e.properties ->> ${query.key})`,
      where: tx`e.type = 2 AND e.name = ${input.name} AND e.properties ? ${query.key}`,
      limit: query.limit,
    });
  });
}
