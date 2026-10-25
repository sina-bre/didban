import { type KeyboardEvent, type ReactNode, useId } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  tabs: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** Content of the selected tab's panel. */
  children: ReactNode;
}

/** Index of the tab a key moves to; arrows follow the reading direction. `-1`: not a tab key. */
export function tabIndexFor(key: string, rtl: boolean, index: number, count: number): number {
  const next = (index + 1) % count;
  const previous = (index - 1 + count) % count;
  const moves: Record<string, number> = {
    ArrowRight: rtl ? previous : next,
    ArrowLeft: rtl ? next : previous,
    Home: 0,
    End: count - 1,
  };
  return moves[key] ?? -1;
}

/** Tabs (APG, automatic activation, ADR 0004): one tab stop, arrows, Home/End. */
export function Tabs<T extends string>({ label, tabs, selected, onSelect, children }: Props<T>) {
  const base = useId();
  const tabId = (id: T) => `${base}-tab-${id}`;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const rtl = event.currentTarget.matches(":dir(rtl)");
    const target = tabs[tabIndexFor(event.key, rtl, index, tabs.length)];
    if (!target) return;
    event.preventDefault();
    onSelect(target.id);
    document.getElementById(tabId(target.id))?.focus();
  };
  const panel = (
    <div
      id={`${base}-panel`}
      role="tabpanel"
      aria-labelledby={tabId(selected)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: APG tabs: the panel is a tab stop
      tabIndex={0}
      className="pt-4"
    >
      {children}
    </div>
  );
  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={tab.id === selected}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className="-mb-px min-h-11 whitespace-nowrap border-transparent border-b-2 px-4 text-body text-muted hover:text-ink aria-selected:border-accent aria-selected:font-medium aria-selected:text-ink"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {panel}
    </div>
  );
}
