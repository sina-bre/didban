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
  /** Known values of a field (from the report data) to pick from. */
  valuesFor: (field: string) => readonly ComboOption[];
  onChange: (filters: Filter[]) => void;
}

/**
 * Filter chips + "Add filter" (field select, then a searchable value: React Aria ComboBox, lazy).
 * Controlled: the report keeps the filters in the URL (Stage 5d).
 */
export function FilterBar({ filters, fields, valuesFor, onChange }: Props) {
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const [field, setField] = useState(fields[0]?.id ?? "");
  const fieldLabel = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  const describe = (f: Filter) =>
    `${fieldLabel(f.field)} ${t(`filter.op.${f.op}` as MessageKey)} ${f.values.join(", ")}`;
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
            onChange={(e) => setField(e.currentTarget.value)}
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </SelectField>
          <Suspense fallback={<Skeleton className="h-16" />}>
            <ComboBox
              key={field}
              label={t("filter.value")}
              options={valuesFor(field)}
              onSelect={add}
              emptyLabel={t("filter.noMatch")}
            />
          </Suspense>
        </div>
      )}
    </section>
  );
}
