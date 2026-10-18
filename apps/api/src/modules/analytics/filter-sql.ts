import {
  CHANNELS,
  DEVICE_TYPES,
  type FilterField,
  SCREEN_CLASSES,
  type StatsFilter,
} from "@didban/contracts";
import type postgres from "postgres";
import type { Sql } from "../../db/db.module.js";

// Spec §10 query safety: filter fields map to `events` columns through this allowlist; values are
// bound parameters; property keys are validated (contracts) and bound too. Coded columns take
// their names (`channel:eq:organicSearch`) and are matched as codes.

type Fragment = postgres.PendingQuery<postgres.Row[]>;

const TEXT_COLUMNS: Partial<Record<FilterField, string>> = {
  hostname: "hostname",
  pathname: "pathname",
  route: "route",
  name: "name",
  referrer: "referrer_source",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
  utm_term: "utm_term",
  utm_content: "utm_content",
  country: "country",
  region: "region",
  city: "city",
  browser: "browser",
  os: "os",
  language: "language",
};

const CODED: Partial<Record<FilterField, { column: string; codes: Record<string, number> }>> = {
  channel: { column: "channel", codes: CHANNELS },
  device_type: { column: "device_type", codes: DEVICE_TYPES },
  screen: {
    column: "screen_class",
    codes: Object.fromEntries(SCREEN_CLASSES.map((s) => [s.name, s.code])),
  },
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function textCondition(sql: Sql, target: Fragment, { op, values }: StatsFilter): Fragment {
  const [value = ""] = values;
  if (op === "eq") return sql`${target} = ${value}`;
  if (op === "neq") return sql`${target} IS DISTINCT FROM ${value}`;
  if (op === "contains") return sql`${target} ILIKE ${`%${escapeLike(value)}%`}`;
  return sql`${target} = ANY(${values}::text[])`;
}

function codedCondition(sql: Sql, column: string, codes: Record<string, number>, f: StatsFilter) {
  const names = Object.keys(codes);
  const lower = f.values.map((v) => v.toLowerCase());
  const picked =
    f.op === "contains"
      ? names.filter((n) => n.toLowerCase().includes(lower[0] ?? ""))
      : names.filter((n) => lower.includes(n.toLowerCase()));
  const matched = picked.map((n) => codes[n] ?? -1);
  const target = sql`e.${sql(column)}`;
  if (f.op === "neq") return sql`${target} IS DISTINCT FROM ${matched[0] ?? -1}`;
  return sql`${target} = ANY(${matched}::smallint[])`;
}

function condition(sql: Sql, input: StatsFilter): Fragment {
  // Country codes are stored upper case (ISO 3166-1 alpha-2).
  const filter =
    input.field === "country"
      ? { ...input, values: input.values.map((v) => v.toUpperCase()) }
      : input;
  if (filter.field.startsWith("prop.")) {
    return textCondition(sql, sql`(e.properties ->> ${filter.field.slice(5)})`, filter);
  }
  const coded = CODED[filter.field];
  if (coded) return codedCondition(sql, coded.column, coded.codes, filter);
  const column = TEXT_COLUMNS[filter.field];
  if (!column) throw new Error(`filter field without a column: ${filter.field}`);
  return textCondition(sql, sql`e.${sql(column)}`, filter);
}

/** `AND …` for every filter on events aliased `e`; an empty fragment when there are none. */
export function filterSql(sql: Sql, filters: readonly StatsFilter[]): Fragment {
  return filters.reduce((all, filter) => sql`${all} AND ${condition(sql, filter)}`, sql``);
}
