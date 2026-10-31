import { type ComponentProps, useId } from "react";
import { CONTROL, describedBy, FieldFrame, type Shared } from "./field";

/** Labelled multi-line input (one origin or path per line), wired like TextField. */
export function TextAreaField({
  label,
  hint,
  error,
  hideLabel,
  className = "",
  ...rest
}: Shared & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, hint, error })}
        className={`${CONTROL} py-2 ${className}`}
        {...rest}
      />
    </FieldFrame>
  );
}
