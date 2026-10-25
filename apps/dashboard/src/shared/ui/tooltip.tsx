import type { ReactNode } from "react";
import { useAnchor } from "./use-anchor";

interface Props {
  /** The tooltip text, also the trigger's description. */
  label: string;
  /** Visible trigger content (kept short: an icon or "—"). */
  children: ReactNode;
}

/**
 * Hand-built tooltip (ADR 0004): shows on hover and keyboard focus, toggles on tap (no
 * hover-only affordance, addendum A6), Escape and outside taps close it (`popover="auto"`).
 */
export function Tooltip({ label, children }: Props) {
  const { id, trigger, popover } = useAnchor();
  const tip = () => document.getElementById(id);
  const show = () => tip()?.showPopover();
  const hide = () => tip()?.hidePopover();
  return (
    <>
      <button
        type="button"
        aria-describedby={id}
        popoverTarget={id}
        style={trigger}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && show()}
        onBlur={hide}
        className="inline-flex min-h-6 min-w-6 cursor-help items-center justify-center rounded-pill"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        popover="auto"
        style={popover}
        className="pop-above max-w-64 rounded-control bg-inverse px-3 py-2 text-caption text-on-inverse shadow-pop"
      >
        {label}
      </span>
    </>
  );
}
