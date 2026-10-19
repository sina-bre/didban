import { NavLink } from "react-router";

export interface NavItem {
  to: string;
  label: string;
}

interface Props {
  label: string;
  items: NavItem[];
}

/** Desktop report navigation: pills on a subtle track; the active one is a navy pill. */
export function PillNav({ label, items }: Props) {
  return (
    <nav aria-label={label} className="min-w-0 overflow-x-auto">
      <ul className="flex w-max gap-1 rounded-pill bg-subtle p-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-body ${
                  isActive ? "bg-inverse text-on-inverse" : "text-muted hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
