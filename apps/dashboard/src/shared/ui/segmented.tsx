import { useId } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  /** Group name read by screen readers (visually hidden legend). */
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/**
 * Segmented pill control on native radios (ADR 0004): arrow keys, RTL order and form semantics
 * come from the browser. The active segment is a navy pill; the track scrolls on small screens.
 */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="min-w-0 max-w-full overflow-x-auto">
      <legend className="sr-only">{label}</legend>
      <div className="flex w-max gap-1 rounded-pill bg-subtle p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-pill px-4 text-body text-muted transition-colors duration-(--duration-fast) ease-(--ease-out) hover:text-ink has-checked:bg-inverse has-checked:text-on-inverse has-focus-visible:outline-2 has-focus-visible:outline-focus has-focus-visible:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
