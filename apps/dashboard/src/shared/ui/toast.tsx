import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, type ReactNode, use, useCallback, useState } from "react";

type Tone = "success" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}
type Notify = (message: string, tone?: Tone) => void;

const ToastContext = createContext<Notify | null>(null);
const DISMISS_AFTER_MS = 5000;
let nextId = 1;

/** `notify("Saved")` from anywhere under `ToastProvider`. */
export function useToast(): Notify {
  const notify = use(ToastContext);
  if (!notify) throw new Error("useToast needs a ToastProvider");
  return notify;
}

interface Props {
  dismissLabel: string;
  children: ReactNode;
}

/**
 * Toasts in one polite live region that always exists (so screen readers hear additions).
 * Each closes after 5 s or on its button; above the mobile tab bar, at the bottom on desktop.
 */
export function ToastProvider({ dismissLabel, children }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const notify = useCallback<Notify>(
    (message, tone = "success") => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );
  return (
    <ToastContext value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} label={dismissLabel} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastItem(props: { toast: Toast; label: string; onDismiss: (id: number) => void }) {
  const { toast, label, onDismiss } = props;
  const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-panel bg-inverse ps-4 text-body text-on-inverse shadow-pop">
      <Icon
        aria-hidden="true"
        className={`size-5 shrink-0 ${toast.tone === "error" ? "text-down-soft" : "text-up-soft"}`}
      />
      <p className="flex-1 py-3">{toast.message}</p>
      <button
        type="button"
        aria-label={label}
        onClick={() => onDismiss(toast.id)}
        className="flex size-11 shrink-0 items-center justify-center rounded-pill"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
