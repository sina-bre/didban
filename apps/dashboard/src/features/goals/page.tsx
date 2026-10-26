import { MAX_GOALS } from "@didban/contracts";
import { Plus, Target } from "lucide-react";
import { useRef } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Card, CardHeader, Dialog, StatePanel } from "../../shared/ui";
import { useCanManage } from "../projects/use-projects";
import { QueryBlock } from "../report/query-block";
import { ReportHeader } from "../report/report-header";
import { GoalForm } from "./goal-form";
import { GoalsTable } from "./goals-table";
import { useGoals } from "./use-goals";

/** Goals (spec §3.1): conversions per goal in the range; managers add and delete goals here. */
export function GoalsPage() {
  const { t } = useLocale();
  const { projectId, goals, create, remove } = useGoals();
  const canManage = useCanManage(projectId);
  const dialog = useRef<HTMLDialogElement>(null);
  const full = (goals.data?.goals.length ?? 0) >= MAX_GOALS;
  const add = canManage && (
    <Button onClick={() => dialog.current?.showModal()} disabled={full}>
      <Plus aria-hidden="true" className="size-4" />
      {t("goals.add")}
    </Button>
  );
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <ReportHeader title={t("nav.goals")} />
      <Card labelledBy="goals-title">
        <CardHeader id="goals-title" icon={Target} title={t("goals.title")} action={add} />
        <QueryBlock query={goals} skeleton="h-72">
          {(data) =>
            data.goals.length === 0 ? (
              <StatePanel icon={Target} title={t("goals.none.title")} body={t("goals.none.body")} />
            ) : (
              <GoalsTable
                goals={data.goals}
                onDelete={canManage ? (goal) => remove.mutateAsync(goal.id) : undefined}
              />
            )
          }
        </QueryBlock>
      </Card>
      {canManage && (
        <Dialog ref={dialog} title={t("goals.add")} closeLabel={t("more.close")}>
          <GoalForm onCreate={create.mutateAsync} onDone={() => dialog.current?.close()} />
        </Dialog>
      )}
    </div>
  );
}
