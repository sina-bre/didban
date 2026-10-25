import { ChevronDown } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useAnchor } from "./use-anchor";

export interface MenuItem {
  id: string;
  label: string;
}

interface Props {
  label: string;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
}

const menuItems = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')];

const step: Record<string, (i: number, n: number) => number> = {
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const move = step[event.key];
  if (!move) return;
  event.preventDefault();
  const all = menuItems(event.currentTarget);
  all[move(all.indexOf(document.activeElement as HTMLElement), all.length)]?.focus();
}

/**
 * Menu button (APG pattern, ADR 0004) on the Popover API: Escape, outside clicks and focus return
 * come from the browser; arrows/Home/End move between items; opening focuses the first item.
 */
export function Menu({ label, items, onSelect }: Props) {
  const { id, trigger, popover } = useAnchor();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-haspopup="menu"
        aria-expanded={open}
        style={trigger}
        className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-ink/20 bg-surface px-4 text-body font-medium hover:bg-subtle"
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      <div
        id={id}
        role="menu"
        aria-label={label}
        popover="auto"
        style={popover}
        onKeyDown={onKeyDown}
        onToggle={(e) => {
          setOpen(e.newState === "open");
          if (e.newState === "open") menuItems(e.currentTarget)[0]?.focus();
        }}
        className="pop-below min-w-48 rounded-panel bg-surface p-1 text-ink shadow-pop"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              document.getElementById(id)?.hidePopover();
              onSelect(item.id);
            }}
            className="flex min-h-11 w-full items-center rounded-control px-3 text-start text-body hover:bg-subtle focus-visible:bg-subtle"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
