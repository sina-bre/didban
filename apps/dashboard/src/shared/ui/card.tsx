import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface CardProps {
  /** Id of the card's title, so the section is announced by name. */
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}

/** White rounded card on the gray canvas, almost flat (design system §1, §2). */
export function Card({ labelledBy, className = "", children }: CardProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`min-w-0 rounded-card-sm bg-surface p-4 shadow-card md:rounded-card md:p-5 lg:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

interface HeaderProps {
  id?: string;
  icon: LucideIcon;
  title: string;
  /** Muted line under the title, e.g. "Performing · 1h". */
  subline?: string;
  /** A text link or pill button at the end of the header. */
  action?: ReactNode;
}

/** 28 px navy circle with a white icon, title, optional subline and an action at the end. */
export function CardHeader({ id, icon: Icon, title, subline, action }: HeaderProps) {
  return (
    <header className="mb-4 flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-inverse text-on-inverse">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="truncate text-title font-medium">
          {title}
        </h2>
        {subline && <p className="truncate text-caption text-muted">{subline}</p>}
      </div>
      {action}
    </header>
  );
}
