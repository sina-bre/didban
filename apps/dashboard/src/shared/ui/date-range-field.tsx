import { GregorianCalendar, parseDate, toCalendar } from "@internationalized/date";
import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import {
  Button,
  DateInput,
  DateRangePicker,
  DateSegment,
  type DateValue,
  Group,
  Label,
  type RangeValue,
} from "react-aria-components/DateRangePicker";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { DateRangeCalendar, NAV } from "./date-range-calendar";

/** ISO `YYYY-MM-DD` days (Gregorian), whatever calendar the user picked in. */
export interface IsoRange {
  start: string;
  end: string;
}

interface Props {
  label: string;
  /** BCP 47 locale; `fa-IR` shows the Persian calendar. */
  locale: string;
  value: IsoRange | null;
  /** Latest selectable day (today). */
  max: string;
  /** Called once per finished edit: on blur, on Enter, or when the calendar closes. */
  onChange: (range: IsoRange) => void;
}

type Draft = RangeValue<DateValue> | null;
const gregorian = new GregorianCalendar();
const toDraft = (v: IsoRange | null): Draft =>
  v && { start: parseDate(v.start), end: parseDate(v.end) };
const iso = (date: DateValue) => toCalendar(date, gregorian).toString().slice(0, 10);
const SEGMENT =
  "rounded-sm px-0.5 tabular-nums outline-none data-focused:bg-inverse data-focused:text-on-inverse data-placeholder:text-muted";

/**
 * Typed + calendar date range on React Aria Components (ADR 0004: one of the two RAC widgets):
 * keyboard grid, RTL and non-Gregorian calendars included. RAC reports every keystroke that forms
 * a valid date (year "2" on the way to "2026"), so edits stay a draft until they are finished.
 */
export default function DateRangeField({ label, locale, value, max, onChange }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(value));
  const latest = useRef<Draft>(draft);
  const [shown, setShown] = useState(value);
  if (shown?.start !== value?.start || shown?.end !== value?.end) {
    // The URL changed (back/forward, a preset): drop the draft for the new value.
    setShown(value);
    setDraft(toDraft(value));
    latest.current = toDraft(value);
  }
  const commit = () => {
    const next = latest.current;
    if (!next) return;
    const range = { start: iso(next.start), end: iso(next.end) };
    if (range.start !== value?.start || range.end !== value?.end) onChange(range);
  };
  return (
    <I18nProvider locale={locale}>
      <DateRangePicker
        value={draft}
        maxValue={parseDate(max)}
        onChange={(next) => {
          latest.current = next;
          setDraft(next);
        }}
        onFocusChange={(focused) => !focused && commit()}
        onOpenChange={(open) => !open && commit()}
        className="flex min-w-0 flex-col gap-1"
      >
        <Label className="text-body font-medium">{label}</Label>
        <Group
          // Capture: the date segments stop Enter from bubbling.
          onKeyDownCapture={(event) => event.key === "Enter" && commit()}
          className="flex min-h-11 items-center gap-1 rounded-control border border-line bg-surface ps-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
        >
          <DateInput slot="start" className="flex">
            {(segment) => <DateSegment segment={segment} className={SEGMENT} />}
          </DateInput>
          <span aria-hidden="true">–</span>
          <DateInput slot="end" className="flex flex-1">
            {(segment) => <DateSegment segment={segment} className={SEGMENT} />}
          </DateInput>
          <Button className={NAV}>
            <CalendarDays aria-hidden="true" className="size-4" />
          </Button>
        </Group>
        <DateRangeCalendar />
      </DateRangePicker>
    </I18nProvider>
  );
}
