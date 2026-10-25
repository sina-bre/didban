import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  Popover,
  RangeCalendar,
} from "react-aria-components/DateRangePicker";
import { Dialog } from "react-aria-components/Dialog";
import { Heading } from "react-aria-components/Heading";

export const NAV = "flex size-11 items-center justify-center rounded-pill hover:bg-subtle";
const CELL =
  "flex size-10 items-center justify-center rounded-pill text-body tabular-nums outline-none " +
  "data-disabled:text-muted/50 data-focus-visible:outline-2 data-focus-visible:outline-focus " +
  "data-outside-month:invisible data-selected:bg-accent-soft data-selection-end:bg-inverse " +
  "data-selection-end:text-on-inverse data-selection-start:bg-inverse " +
  "data-selection-start:text-on-inverse";

/** The month grid popover of DateRangeField (React Aria keyboard grid; chevrons mirror in RTL). */
export function DateRangeCalendar() {
  return (
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
            {(date) => <CalendarCell date={date} className={CELL} />}
          </CalendarGrid>
        </RangeCalendar>
      </Dialog>
    </Popover>
  );
}
