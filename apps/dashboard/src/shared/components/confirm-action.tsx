import { useRef, useState } from "react";
import { useLocale } from "../lib/locale-context";
import { Button, Dialog } from "../ui";

interface Props {
  /** The button that opens the dialog, e.g. "Revoke". */
  label: string;
  /** Accessible name when the visible label is not unique in a table ("Revoke key dpk_…"). */
  name?: string;
  title: string;
  body: string;
  confirm: string;
  /** Rejects to keep the dialog open with the message it returns. */
  onConfirm: () => Promise<unknown>;
  failure: (error: unknown) => string;
}

/** A destructive action behind a confirmation dialog (revoke, remove, archive, suspend). */
export function ConfirmAction({ label, name, title, body, confirm, onConfirm, failure }: Props) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      await onConfirm();
      dialog.current?.close();
    } catch (cause) {
      setError(failure(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Button
        aria-label={name}
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        {label}
      </Button>
      <Dialog ref={dialog} title={title} closeLabel={t("more.close")}>
        <p className="mb-4 text-body text-muted">{body}</p>
        {error && (
          <p role="alert" className="mb-4 text-body text-down">
            {error}
          </p>
        )}
        <Button variant="primary" disabled={pending} onClick={() => void run()}>
          {confirm}
        </Button>
      </Dialog>
    </>
  );
}
