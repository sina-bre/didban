import type { BreakdownResponse, SourcesQuery, VisitRow } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { visitBreakdown } from "./breakdown-sql.js";
import { channelName } from "./labels.js";
import { type ReportInput, runReport } from "./report.js";

// `GET …/stats/sources?by=` (spec §4 first touch): the visit's first page view's UTM, else its
// referrer, as stored on `visits` by the writer. Columns come from this map only.
const COLUMNS: Record<SourcesQuery["by"], string> = {
  referrer: "referrer_source",
  channel: "channel",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
  utm_term: "utm_term",
  utm_content: "utm_content",
};

export function getSources(
  sql: Sql,
  scope: AccessScope,
  input: ReportInput<SourcesQuery>,
): Promise<BreakdownResponse<VisitRow>> {
  return runReport(sql, scope, input, (tx, context, query) =>
    visitBreakdown(tx, context, {
      dimension: tx`v.${tx(COLUMNS[query.by])}`,
      limit: query.limit,
      ...(query.by === "channel" ? { label: channelName } : {}),
    }),
  );
}
