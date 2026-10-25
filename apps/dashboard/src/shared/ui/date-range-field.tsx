import { GregorianCalendar, parseDate, toCalendar } from "@internationalized/date";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateRangePicker,
  DateSegment,
  type DateValue,
  Group,
  Label,
  Popover,
  RangeCalendar,
} from "react-aria-components/DateRangePicker";
import { Dialog } from "react-aria-components/Dialog";
import { Heading } from "react-aria-components/Heading";
import { I18nProvider } from "react-aria-components/I18nProvider";

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
  onChange: (range: IsoRange) => void;
}

const gregorian = new GregorianCalendar();
const iso = (date: DateValue) => toCalendar(date, gregorian).toString().slice(0, 10);
const SEGMENT =
  "rounded-sm px-0.5 tabular-nums outline-none data-focused:bg-inverse data-focused:text-on-inverse data-placeholder:text-muted";
const NAV = "flex size-11 items-center justify-center rounded-pill hover:bg-subtle";

/**
 * Typed + calendar date range on React Aria Components (ADR 0004: one of the two RAC widgets):
 * keyboard grid, RTL and non-Gregorian calendars included. Lazy-load it with the filter bar.
 */
export default function DateRangeField({ label, locale, value, max, onChange }: Props) {
  const range = value && { start: parseDate(value.start), end: parseDate(value.end) };
  return (
    <I18nProvider locale={locale}>
      <DateRangePicker
        value={range}
        maxValue={parseDate(max)}
        onChange={(next) => next && onChange({ start: iso(next.start), end: iso(next.end) })}
        className="flex min-w-0 flex-col gap-1"
      >
        <Label className="text-body font-medium">{label}</Label>
        <Group className="flex min-h-11 items-center gap-1 rounded-control border border-line bg-surface ps-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
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
        <Popover className="rounded-panel bg-surface p-3 text-ink shadow-pop">
          <Dialog className="outline-none">
            <RangeCalendar>
              <header className="flex items-center justify-between">
                <Button slot="previous" className={NAV}>
                  <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </Button>
                <Heading className="text-title font-medium" />
                <Button slot="next" className={NAV}>
                  <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </Button>
              </header>
              <CalendarGrid className="border-separate border-spacing-0.5">
                {(date) => (
                  <CalendarCell
                    date={date}
                    className="flex size-10 items-center justify-center rounded-pill text-body tabular-nums outline-none data-disabled:text-muted/50 data-focus-visible:outline-2 data-focus-visible:outline-focus data-outside-month:invisible data-selected:bg-accent-soft data-selection-end:bg-inverse data-selection-end:text-on-inverse data-selection-start:bg-inverse data-selection-start:text-on-inverse"
                  />
                )}
              </CalendarGrid>
            </RangeCalendar>
          </Dialog>
        </Popover>
      </DateRangePicker>
    </I18nProvider>
  );
}
