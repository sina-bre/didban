import { X } from "lucide-react";

interface Props {
  label: string;
  /** Accessible name of the remove button, e.g. "Remove filter Country is Iran". */
  removeLabel: string;
  onRemove: () => void;
}

/** Filter chip: a pill with its text and a 44 px remove button. */
export function Chip({ label, removeLabel, onRemove }: Props) {
  return (
    <span className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-pill bg-accent-soft ps-3 text-body text-ink">
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="flex size-11 shrink-0 items-center justify-center rounded-pill text-muted hover:text-ink"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </span>
  );
}
