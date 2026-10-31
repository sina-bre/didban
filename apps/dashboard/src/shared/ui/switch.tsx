interface Props {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Uncontrolled use inside a plain `<form>`: the value is read from FormData (`name` → "on"). */
  name?: string;
  defaultChecked?: boolean;
}

/** On/off toggle on a native checkbox with `role="switch"` (ADR 0004), e.g. "Compare". */
export function Switch({ label, checked, onChange, name, defaultChecked }: Props) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 text-body">
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        defaultChecked={defaultChecked}
        name={name}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 shrink-0 rounded-pill bg-line transition-colors duration-(--duration-fast) peer-checked:bg-inverse peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-pill after:bg-surface after:transition-transform after:duration-(--duration-fast) peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4"
      />
      {label}
    </label>
  );
}
