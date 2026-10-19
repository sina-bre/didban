import { X } from "lucide-react";
import { type ReactNode, type Ref, useId } from "react";
import { Button } from "./button";

interface Props {
  ref: Ref<HTMLDialogElement>;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/**
 * Bottom sheet on the native modal `<dialog>` (ADR 0004): focus trap, Escape and inert
 * background come from the browser; `closedby="any"` adds the backdrop tap (light dismiss).
 * Open it with `showModal()`.
 */
export function Sheet({ ref, title, closeLabel, children }: Props) {
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      closedby="any"
      className="pb-safe m-0 mt-auto w-full max-w-none rounded-t-card-sm bg-surface p-4 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <div className="mb-2 flex items-center justify-between">
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
