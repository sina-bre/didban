import type { CreateGoalRequest } from "@didban/contracts";
import { useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Segmented, TextField } from "../../shared/ui";
import { type GoalKind, useGoalForm } from "./use-goal-form";

interface Props {
  onCreate: (goal: CreateGoalRequest) => Promise<unknown>;
  onDone: () => void;
}

/** New goal (spec §3.1): a name and an event name or a page path pattern. */
export function GoalForm({ onCreate, onDone }: Props) {
  const { t } = useLocale();
  const [kind, setKind] = useState<GoalKind>("event");
  const { errors, pending, submit } = useGoalForm({ kind, onCreate, onDone });
  const options = (["event", "page"] as const).map((k) => ({
    value: k,
    label: t(`goals.kind.${k}`),
  }));
  const match =
    kind === "event"
      ? { name: "eventName", label: t("goals.eventName"), hint: t("goals.eventHint") }
      : { name: "pathPattern", label: t("goals.pathPattern"), hint: t("goals.pathHint") };
  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <TextField label={t("goals.name")} name="name" required maxLength={100} error={errors.name} />
      <Segmented label={t("goals.kind")} value={kind} options={options} onChange={setKind} />
      <TextField key={kind} {...match} dir="ltr" required error={errors[match.name]} />
      {errors.form && (
        <p role="alert" className="text-body text-down">
          {errors.form}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {t("goals.create")}
      </Button>
    </form>
  );
}
