import type { BreakdownResponse } from "@didban/contracts";
import type { ComboOption } from "../../shared/ui";
import { FILTER_FIELDS } from "./filter-fields";
import { useBreakdownQuery, useStats } from "./use-stats";

type AnyRow = Parameters<(typeof FILTER_FIELDS)[number]["pick"]>[0];

/**
 * The known values of a filter field in the current range (and filters), from that field's own
 * breakdown, up to 100. Nothing is requested until a field is picked.
 */
export function useFilterValues(field: string, label: (value: string) => string): ComboOption[] {
  const source = FILTER_FIELDS.find((f) => f.id === field);
  const { projectId, query } = useBreakdownQuery();
  const values = useStats<BreakdownResponse<AnyRow>>(
    projectId,
    source?.report ?? "pages",
    { ...query, ...source?.params, limit: "100" },
    source !== undefined,
  );
  // The previous field's rows are no values of this one.
  if (!source || !values.data || values.isPlaceholderData) return [];
  const seen = new Set<string>();
  for (const row of values.data.rows) {
    const value = source.pick(row);
    if (value) seen.add(value);
  }
  return [...seen].map((id) => ({ id, label: label(id) }));
}
