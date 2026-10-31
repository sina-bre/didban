import { type ComponentProps, type ReactNode, type SelectHTMLAttributes, useId } from "react";

export interface Shared {
  label: string;
  hint?: string;
  /** Validation message; marks the control invalid and is announced with it. */
  error?: string;
  /** Label for screen readers only (a role picker inside a table row). */
  hideLabel?: boolean;
}

export const CONTROL =
  "min-h-11 w-full rounded-control border border-line bg-surface px-3 text-body text-ink " +
  "aria-invalid:border-down disabled:bg-subtle disabled:text-muted";

export function FieldFrame(props: Shared & { id: string; children: ReactNode }) {
  const { id, label, hint, error, hideLabel, children } = props;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-body font-medium"}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-caption text-down">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, { hint, error }: Shared): string | undefined {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** `ComponentProps` includes `ref` (React 19), so form libraries can register the input. */
type TextProps = Shared & ComponentProps<"input">;

/** Labelled text input with hint and error wired to `aria-describedby` / `aria-invalid`. */
export function TextField(props: TextProps) {
  const { label, hint, error, hideLabel, className = "", ...rest } = props;
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, hint, error })}
        className={`${CONTROL} ${className}`}
        {...rest}
      />
    </FieldFrame>
  );
}

type SelectProps = Shared & SelectHTMLAttributes<HTMLSelectElement>;

/** Labelled native `<select>` (ADR 0004: native first). */
export function SelectField({
  label,
  hint,
  error,
  hideLabel,
  className = "",
  children,
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, hint, error })}
        className={`${CONTROL} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
