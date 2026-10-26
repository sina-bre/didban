import {
  type FilterOp,
  formatFilter,
  MAX_FILTERS,
  parseFilter,
  type StatsFilter,
} from "@didban/contracts";

// Spec §3.1 + §13.4: report filters live in the URL as repeated `?filter=field:op:value` (the
// API's own syntax, parsed with its own parser), so a filtered view is a shareable link.

const keyOf = (filter: StatsFilter) => formatFilter(filter);

/** Valid, distinct filters in URL order, at most the API's MAX_FILTERS. Anything else is dropped. */
export function readFilters(params: URLSearchParams): StatsFilter[] {
  const seen = new Set<string>();
  const filters: StatsFilter[] = [];
  for (const raw of params.getAll("filter")) {
    const filter = parseFilter(raw);
    if (!filter || seen.has(keyOf(filter))) continue;
    seen.add(keyOf(filter));
    filters.push(filter);
  }
  return filters.slice(0, MAX_FILTERS);
}

type FilterLike = { field: string; op: FilterOp; values: readonly string[] };

/** A copy of `params` with exactly these filters (range, compare and the rest unchanged). */
export function withFilters(params: URLSearchParams, filters: readonly FilterLike[]) {
  const next = new URLSearchParams(params);
  next.delete("filter");
  for (const { field, op, values } of filters.slice(0, MAX_FILTERS)) {
    next.append("filter", `${field}:${op}:${values.join("|")}`);
  }
  return next;
}

/** `field is value` added to the URL's filters (no duplicate; a full list stays as it is). */
export function withEquals(params: URLSearchParams, field: string, value: string) {
  const filter = parseFilter(`${field}:eq:${value}`);
  const current = readFilters(params);
  if (!filter || current.length >= MAX_FILTERS) return new URLSearchParams(params);
  return withFilters(params, [...current, filter]);
}
