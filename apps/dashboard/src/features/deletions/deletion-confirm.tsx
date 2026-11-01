import { type Ref, useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Dialog } from "../../shared/ui";
import { failureText } from "../settings/failure-text";

interface Props {
  ref: Ref<HTMLDialogElement>;
  /** Sends the request; a rejection keeps the dialog open with its message. */
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

/** The last step before an irreversible deletion is queued. */
export function DeletionConfirm({ ref, onConfirm, onClose }: Props) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(failureText(t, cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      ref={ref}
      title={t("deletion.confirmTitle")}
      closeLabel={t("more.close")}
      onClose={() => {
        setError(null);
        onClose();
      }}
    >
      <p className="mb-4 text-body text-muted">{t("deletion.confirmBody")}</p>
      {error && (
        <p role="alert" className="mb-4 text-body text-down">
          {error}
        </p>
      )}
      <Button variant="primary" disabled={pending} onClick={() => void run()}>
        {t("deletion.confirm")}
      </Button>
    </Dialog>
  );
}
