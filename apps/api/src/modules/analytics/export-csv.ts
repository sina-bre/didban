import * as c from "@didban/contracts";
import type { z } from "zod";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { AppError } from "../../http/app-error.js";
import { toCsv } from "./csv.js";
import { getEventProperties, getEvents } from "./events-report.js";
import { getDevices, getGeo } from "./geo-devices.js";
import { getPages } from "./pages.js";
import { getSources } from "./sources.js";

// `GET …/stats/export.csv` (spec §3.1 "CSV export of any breakdown table"): the same report code
// with that report's own parameters, up to MAX_EXPORT_ROWS rows instead of 100.

const EVENT_COLUMNS = ["value", "visitors", "pageviews", "events"];
const VISIT_COLUMNS = ["value", "visitors", "visits", "bounceRate", "visitDuration"];
const PAGE_COLUMNS: Record<c.PagesQuery["view"], string[]> = {
  top: ["hostname", "route", "visitors", "pageviews"],
  entry: VISIT_COLUMNS,
  exit: VISIT_COLUMNS,
  discovered: ["hostname", "route", "firstSeenAt", "lastSeenAt", "lastTitle"],
};

type Rows = { rows: object[]; columns: string[] };
type Run = (sql: Sql, scope: AccessScope, projectId: string, raw: object) => Promise<Rows>;

function parse<S extends z.ZodType>(schema: S, raw: object): z.output<S> & { limit: number } {
  const result = schema.safeParse(raw);
  if (!result.success) throw new AppError(400, "VALIDATION_FAILED", "Invalid request");
  return { ...(result.data as object), limit: c.MAX_EXPORT_ROWS } as z.output<S> & {
    limit: number;
  };
}

const RUNS: Record<Exclude<c.ExportReport, "properties" | "pages">, Run> = {
  sources: async (sql, scope, projectId, raw) => {
    const query = parse(c.sourcesQuerySchema, raw);
    return {
      rows: (await getSources(sql, scope, { projectId, query })).rows,
      columns: VISIT_COLUMNS,
    };
  },
  geo: async (sql, scope, projectId, raw) => {
    const query = parse(c.geoQuerySchema, raw);
    return { rows: (await getGeo(sql, scope, { projectId, query })).rows, columns: EVENT_COLUMNS };
  },
  devices: async (sql, scope, projectId, raw) => {
    const query = parse(c.devicesQuerySchema, raw);
    return {
      rows: (await getDevices(sql, scope, { projectId, query })).rows,
      columns: EVENT_COLUMNS,
    };
  },
  events: async (sql, scope, projectId, raw) => {
    const query = parse(c.eventsQuerySchema, raw);
    return {
      rows: (await getEvents(sql, scope, { projectId, query })).rows,
      columns: EVENT_COLUMNS,
    };
  },
};

async function rowsOf(
  sql: Sql,
  scope: AccessScope,
  projectId: string,
  raw: Record<string, unknown>,
) {
  const { report, event } = parse(c.exportQuerySchema, raw);
  const rest = Object.fromEntries(
    Object.entries(raw).filter(([k]) => !["report", "event", "limit"].includes(k)),
  );
  if (report === "pages") {
    const query = parse(c.pagesQuerySchema, rest);
    const { rows } = await getPages(sql, scope, { projectId, query });
    return { report, rows, columns: PAGE_COLUMNS[query.view] };
  }
  if (report === "properties") {
    if (!event) throw new AppError(400, "VALIDATION_FAILED", "`event` is required");
    const query = parse(c.eventPropertiesQuerySchema, rest);
    const { rows } = await getEventProperties(sql, scope, { projectId, query, name: event });
    return { report, rows, columns: EVENT_COLUMNS };
  }
  return { report, ...(await RUNS[report](sql, scope, projectId, rest)) };
}

export async function exportCsv(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; raw: Record<string, unknown> },
): Promise<{ filename: string; body: string }> {
  const { report, rows, columns } = await rowsOf(sql, scope, input.projectId, input.raw);
  const day = (key: string) =>
    String(input.raw[key] ?? "")
      .slice(0, 10)
      .replace(/[^0-9-]/g, "");
  const filename = `didban-${report}-${day("from")}-${day("to")}.csv`;
  return { filename, body: toCsv(columns, rows as Record<string, unknown>[]) };
}
