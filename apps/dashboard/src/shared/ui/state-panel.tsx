import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Extra lines (request ID) and actions (retry, snippet link). */
  children?: ReactNode;
  /** `alert` for failures so they are announced; empty and denied states stay quiet. */
  role?: "alert";
}

/** Centered icon, title and body inside a card: empty, error and 403 states share it. */
export function StatePanel({ icon: Icon, title, body, children, role }: Props) {
  return (
    <div role={role} className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-pill bg-subtle text-muted">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-title font-medium">{title}</h2>
      <p className="max-w-prose text-body text-muted">{body}</p>
      {children}
    </div>
  );
}
