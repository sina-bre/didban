import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "justify-center bg-inverse px-5 text-on-inverse hover:bg-navy-700 disabled:opacity-60",
  outline: "text-ink border border-ink/20 bg-surface px-4 hover:bg-subtle",
  ghost: "text-ink min-w-11 justify-center px-2 hover:bg-subtle",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Pill button. ≥ 44 px tall (addendum A6). */
export function Button({ variant = "outline", className = "", type = "button", ...rest }: Props) {
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-pill text-body font-medium " +
    "transition-colors duration-(--duration-fast) ease-(--ease-out)";
  return <button type={type} className={`${base} ${VARIANTS[variant]} ${className}`} {...rest} />;
}
