import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import { useLocale } from "../lib/locale-context";
import {
  type CustomRange,
  isoDay,
  RANGE_PRESETS,
  type RangePreset,
  rangeDays,
  readCustomRange,
  readRange,
} from "../lib/url-state";
import { Button, Segmented, Skeleton } from "../ui";

const DateRangeField = lazy(() => import("../ui/date-range-field"));

/** The search params with the range replaced, other params (filters) kept. */
function withRange(current: URLSearchParams, range: Record<string, string>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ["range", "from", "to"]) next.delete(key);
  for (const [key, value] of Object.entries(range)) next.set(key, value);
  return next;
}

/**
 * The report range, kept in the URL (spec §13.4): preset pills, plus "Custom" that reveals the
 * React Aria date range field (lazy, ADR 0004). It is inline, not in a modal, so the field's own
 * calendar popover is never behind an inert backdrop.
 */
export function DateRangePicker() {
  const { t, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const custom = readCustomRange(params);
  const [open, setOpen] = useState(custom !== null);
  const options = RANGE_PRESETS.map((value) => ({
    value,
    label: value === "today" ? t("range.today") : t("range.days", { count: rangeDays(value) }),
  }));
  const pickPreset = (preset: RangePreset) => {
    setOpen(false);
    setParams((current) => withRange(current, { range: preset }));
  };
  const pickCustom = (range: CustomRange) =>
    // A half-typed year ("0002") is a valid date to React Aria; only real ranges reach the URL.
    readCustomRange(new URLSearchParams({ ...range })) &&
    setParams((current) => withRange(current, { ...range }));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Segmented<RangePreset | "">
          label={t("range.label")}
          value={custom ? "" : readRange(params)}
          options={options}
          onChange={(value) => value && pickPreset(value)}
        />
        <Button
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={custom ? "border-ink" : ""}
        >
          {t("range.custom")}
        </Button>
      </div>
      {open && (
        <Suspense fallback={<Skeleton className="h-16 max-w-sm" />}>
          <div className="max-w-sm">
            <DateRangeField
              label={t("range.dates")}
              locale={locale === "fa" ? "fa-IR" : "en-US"}
              value={custom && { start: custom.from, end: custom.to }}
              max={isoDay(new Date())}
              onChange={({ start, end }) => pickCustom({ from: start, to: end })}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}
