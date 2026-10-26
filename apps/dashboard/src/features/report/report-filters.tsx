import { useState } from "react";
import { useSearchParams } from "react-router";
import { FilterBar } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { readFilters, withFilters } from "../../shared/lib/url-filters";
import { dimensionLabel } from "./dimension-label";
import { FILTER_FIELDS } from "./filter-fields";
import { useFilterValues } from "./use-filter-values";

/** The FilterBar bound to the URL's `?filter=` (spec §13.4: back/forward restores it). */
export function ReportFilters() {
  const { t, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const [field, setField] = useState("");
  const filters = readFilters(params);
  const label = (f: string, value: string) => dimensionLabel({ t, locale, field: f }, value);
  const values = useFilterValues(field, (value) => label(field, value));
  const fields = FILTER_FIELDS.map((f) => ({ id: f.id, label: t(f.label) }));
  // Property filters come from the Events report; they still need a name on their chip.
  for (const f of filters) {
    if (f.field.startsWith("prop.") && !fields.some((known) => known.id === f.field)) {
      fields.push({ id: f.field, label: t("field.prop", { key: f.field.slice(5) }) });
    }
  }
  return (
    <FilterBar
      filters={filters}
      fields={fields}
      field={field}
      onFieldChange={setField}
      values={values}
      valueLabel={label}
      onChange={(next) => {
        setParams(withFilters(params, next));
        setField("");
      }}
    />
  );
}
