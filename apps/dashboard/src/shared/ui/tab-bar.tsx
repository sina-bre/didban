import type { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

/** Mobile/tablet bottom tab bar (≤ 5 items, safe-area aware). Hidden from `lg` up. */
export function TabBar({ label, children }: Props) {
  return (
    <nav
      aria-label={label}
      className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface lg:hidden"
    >
      <ul className="mx-auto grid max-w-content auto-cols-fr grid-flow-col">{children}</ul>
    </nav>
  );
}
