import type { GoalStats } from "@didban/contracts";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Dialog } from "../../shared/ui";

interface Props {
  goal: GoalStats;
  onDelete: (goal: GoalStats) => Promise<unknown>;
}

/** Delete with a confirmation dialog: a goal's definition is gone for every range at once. */
export function DeleteGoal({ goal, onDelete }: Props) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    try {
      await onDelete(goal);
      dialog.current?.close();
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        aria-label={t("goals.delete", { name: goal.name })}
        onClick={() => {
          setFailed(false);
          dialog.current?.showModal();
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
      <Dialog
        ref={dialog}
        title={t("goals.deleteTitle", { name: goal.name })}
        closeLabel={t("more.close")}
      >
        <p className="mb-4 text-body text-muted">{t("goals.deleteBody")}</p>
        {failed && (
          <p role="alert" className="mb-4 text-body text-down">
            {t("state.error.body")}
          </p>
        )}
        <Button variant="primary" onClick={() => void confirm()}>
          {t("goals.deleteConfirm")}
        </Button>
      </Dialog>
    </>
  );
}
