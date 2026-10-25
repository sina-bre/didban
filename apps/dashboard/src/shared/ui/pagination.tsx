import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface Props {
  label: string;
  /** e.g. "Page 2 of 5", already localized. */
  status: string;
  previousLabel: string;
  nextLabel: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Previous / next pager. Chevrons mirror in RTL (design system §4). */
export function Pagination(props: Props) {
  const { label, status, hasPrevious, hasNext, onPrevious, onNext } = props;
  return (
    <nav aria-label={label} className="flex items-center justify-end gap-2 pt-2">
      <p aria-live="polite" className="text-caption text-muted tabular-nums">
        {status}
      </p>
      <Button
        variant="ghost"
        aria-label={props.previousLabel}
        disabled={!hasPrevious}
        onClick={onPrevious}
        className="disabled:opacity-40"
      >
        <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Button>
      <Button
        variant="ghost"
        aria-label={props.nextLabel}
        disabled={!hasNext}
        onClick={onNext}
        className="disabled:opacity-40"
      >
        <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Button>
    </nav>
  );
}
