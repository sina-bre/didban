import { Plus } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { MessageKey } from "../lib/i18n";
import { useLocale } from "../lib/locale-context";
import { Button, Chip, type ComboOption, SelectField, Skeleton } from "../ui";

const ComboBox = lazy(() => import("../ui/combo-box"));

/** Mirrors `StatsFilter` in @didban/contracts (`field:op:value`, spec §10). */
export interface Filter {
  field: string;
  op: "eq" | "neq" | "contains" | "in";
  values: string[];
}

interface Props {
  filters: readonly Filter[];
  /** Fields the report can filter on, with their labels. */
  fields: readonly ComboOption[];
  /** The field being added ("" = none picked yet); the owner loads its values. */
  field: string;
  onFieldChange: (field: string) => void;
  /** Known values of `field` to pick from. */
  values: readonly ComboOption[];
  /** A stored value in the user's words (`DE` → "Germany"); defaults to the value itself. */
  valueLabel?: (field: string, value: string) => string;
  onChange: (filters: Filter[]) => void;
}

/**
 * Filter chips + "Add filter" (field select, then a searchable value: React Aria ComboBox, lazy).
 * Controlled: reports keep the filters in the URL and load the values of the picked field.
 */
export function FilterBar(props: Props) {
  const { filters, fields, field, onFieldChange, values, onChange } = props;
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const fieldLabel = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  const valueLabel = props.valueLabel ?? ((_: string, value: string) => value);
  const describe = (f: Filter) =>
    `${fieldLabel(f.field)} ${t(`filter.op.${f.op}` as MessageKey)} ${f.values.map((v) => valueLabel(f.field, v)).join(", ")}`;
  const add = (value: string) => {
    onChange([...filters, { field, op: "eq", values: [value] }]);
    setAdding(false);
  };
  return (
    <section aria-label={t("filter.label")} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {filters.map((f, index) => (
          <Chip
            key={`${f.field}:${f.op}:${f.values.join("|")}`}
            label={describe(f)}
            removeLabel={t("filter.remove", { filter: describe(f) })}
            onRemove={() => onChange(filters.filter((_, i) => i !== index))}
          />
        ))}
        <Button aria-expanded={adding} onClick={() => setAdding(!adding)}>
          <Plus aria-hidden="true" className="size-4" />
          {t("filter.add")}
        </Button>
      </div>
      {adding && (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <SelectField
            label={t("filter.field")}
            value={field}
            onChange={(e) => onFieldChange(e.currentTarget.value)}
          >
            <option value="">{t("filter.pickField")}</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </SelectField>
          {field && (
            <Suspense fallback={<Skeleton className="h-16" />}>
              <ComboBox
                // Remount when the values arrive: RAC reads `defaultItems` once.
                key={`${field}:${values.length}`}
                label={t("filter.value")}
                options={values}
                onSelect={add}
                emptyLabel={t("filter.noMatch")}
              />
            </Suspense>
          )}
        </div>
      )}
    </section>
  );
}
