import { X } from "lucide-react";
import { type ReactNode, type Ref, useId } from "react";
import { Button } from "./button";

interface Props {
  ref: Ref<HTMLDialogElement>;
  title: string;
  closeLabel: string;
  /** `sheet` slides from the bottom (mobile "More"); `center` is a regular modal. */
  placement?: "sheet" | "center";
  /** After any close (button, Escape, backdrop): drop one-time content, stop polling. */
  onClose?: () => void;
  children: ReactNode;
}

const PLACEMENT = {
  sheet: "pb-safe m-0 mt-auto w-full max-w-none rounded-t-card-sm",
  // The UA max-width (100% − 2em) keeps it inside a 360 px screen.
  center: "m-auto w-lg rounded-card-sm md:rounded-card",
};

/**
 * Modal on the native `<dialog>` (ADR 0004): focus trap, Escape and inert background come from
 * the browser; `closedby="any"` adds the backdrop tap (light dismiss). Open it with `showModal()`.
 */
export function Dialog(props: Props) {
  const { ref, title, closeLabel, placement = "center", onClose, children } = props;
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      closedby="any"
      onClose={onClose}
      className={`${PLACEMENT[placement]} bg-surface p-4 text-ink shadow-pop backdrop:bg-ink/40 md:p-5`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-title font-medium">
          {title}
        </h2>
        <form method="dialog">
          <Button type="submit" variant="ghost" aria-label={closeLabel}>
            <X aria-hidden="true" className="size-5" />
          </Button>
        </form>
      </div>
      {children}
    </dialog>
  );
}
