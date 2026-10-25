import { type CSSProperties, useId } from "react";

/** Paired styles that tie a popover to its trigger (CSS anchor positioning, ADR 0040). */
export function useAnchor(): { trigger: CSSProperties; popover: CSSProperties; id: string } {
  const id = useId();
  const name = `--a${id.replace(/[^\w-]/g, "")}`;
  return { id, trigger: { anchorName: name }, popover: { positionAnchor: name } };
}
