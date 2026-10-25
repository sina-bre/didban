import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Tooltip } from "./tooltip";

interface Props {
  /** Relative change; `null` when there is no comparable previous value (spec §4). */
  value: number | null;
  /** The formatted change, e.g. "+1.1%". */
  text: string;
  /** Why there is no delta, shown as a tooltip on "—". */
  nullHint: string;
}

const BASE = "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium";

/** Comparison delta: color is paired with a sign and an arrow (design system §4). */
export function DeltaBadge({ value, text, nullHint }: Props) {
  if (value === null) {
    return (
      <span className={`${BASE} bg-subtle text-muted`}>
        <Tooltip label={nullHint}>—</Tooltip>
      </span>
    );
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const tone =
    value > 0
      ? "bg-up-soft text-up"
      : value < 0
        ? "bg-down-soft text-down"
        : "bg-subtle text-muted";
  return (
    <span className={`${BASE} ${tone}`}>
      <Icon aria-hidden="true" className="size-3" />
      <bdi className="tabular-nums">{text}</bdi>
    </span>
  );
}
