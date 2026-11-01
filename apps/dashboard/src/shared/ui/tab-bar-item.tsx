import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

interface Props {
  label: string;
  icon: LucideIcon;
  /** A link to a route, or a button (`onClick`) for "More". */
  to?: string;
  onClick?: () => void;
  /** Highlights a button item, e.g. "More" while one of its reports is open. */
  active?: boolean;
}

const BASE = "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-caption w-full";
const tone = (active: boolean) => (active ? "text-accent-text font-medium" : "text-muted");

export function TabBarItem({ label, icon: Icon, to, onClick, active = false }: Props) {
  const body = (
    <>
      <Icon aria-hidden="true" className="size-5" />
      <span>{label}</span>
    </>
  );
  return (
    <li>
      {to ? (
        <NavLink to={to} className={({ isActive }) => `${BASE} ${tone(isActive)}`}>
          {body}
        </NavLink>
      ) : (
        <button type="button" onClick={onClick} className={`${BASE} ${tone(active)}`}>
          {body}
        </button>
      )}
    </li>
  );
}
