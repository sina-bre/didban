import { Check } from "lucide-react";

interface Props {
  label: string;
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Locale digits for the step numbers (`fa` shows ۱ ۲ ۳). */
  formatNumber: (value: number) => string;
}

/**
 * Onboarding progress (create project → environment → key → live check). The current step is
 * `aria-current="step"`; below `sm` only its label is shown so four steps fit at 360 px.
 */
export function Stepper({ label, steps, current, formatNumber }: Props) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 items-center gap-2 not-last:flex-1"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-pill text-caption font-medium tabular-nums ${
                  active || done ? "bg-inverse text-on-inverse" : "bg-subtle text-muted"
                }`}
              >
                {done ? <Check aria-hidden="true" className="size-4" /> : formatNumber(index + 1)}
              </span>
              <span
                className={`truncate text-body ${active ? "font-medium" : "sr-only text-muted sm:not-sr-only"}`}
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-line" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
