import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useId } from "react";

interface Shared {
  label: string;
  hint?: string;
  /** Validation message; marks the control invalid and is announced with it. */
  error?: string;
}

const CONTROL =
  "min-h-11 w-full rounded-control border border-line bg-surface px-3 text-body text-ink " +
  "aria-invalid:border-down disabled:bg-subtle disabled:text-muted";

function FieldFrame(props: Shared & { id: string; children: ReactNode }) {
  const { id, label, hint, error, children } = props;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-body font-medium">
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

function describedBy(id: string, { hint, error }: Shared): string | undefined {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type TextProps = Shared & InputHTMLAttributes<HTMLInputElement>;

/** Labelled text input with hint and error wired to `aria-describedby` / `aria-invalid`. */
export function TextField({ label, hint, error, className = "", ...rest }: TextProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
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
  className = "",
  children,
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
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
