import type { BreakdownResponse, DevicesQuery, EventRow, GeoQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { eventBreakdown } from "./breakdown-sql.js";
import { deviceTypeName, screenName } from "./labels.js";
import { type ReportInput, runReport } from "./report.js";

// `GET …/stats/geo?by=` and `…/stats/devices?by=`: browser events grouped by one column of
// `events` (region, city, screen and language exist only there). Columns from these maps only.
const GEO: Record<GeoQuery["by"], string> = { country: "country", region: "region", city: "city" };
const DEVICES: Record<DevicesQuery["by"], string> = {
  browser: "browser",
  os: "os",
  device_type: "device_type",
  screen: "screen_class",
  language: "language",
};
const LABELS: Partial<Record<DevicesQuery["by"], (raw: string | null) => string | null>> = {
  device_type: deviceTypeName,
  screen: screenName,
};

export function getGeo(sql: Sql, scope: AccessScope, input: ReportInput<GeoQuery>) {
  return runReport(sql, scope, input, (tx, context, query) =>
    eventBreakdown(tx, context, {
      dimension: tx`e.${tx(GEO[query.by])}`,
      where: tx`e.source = 1`,
      limit: query.limit,
    }),
  ) as Promise<BreakdownResponse<EventRow>>;
}

export function getDevices(sql: Sql, scope: AccessScope, input: ReportInput<DevicesQuery>) {
  return runReport(sql, scope, input, (tx, context, query) => {
    const label = LABELS[query.by];
    return eventBreakdown(tx, context, {
      dimension: tx`e.${tx(DEVICES[query.by])}`,
      where: tx`e.source = 1`,
      limit: query.limit,
      ...(label ? { label } : {}),
    });
  }) as Promise<BreakdownResponse<EventRow>>;
}
