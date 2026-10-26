import { type CreateGoalRequest, createGoalRequestSchema } from "@didban/contracts";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../shared/lib/api-client";
import { useLocale } from "../../shared/lib/locale-context";

export type GoalKind = CreateGoalRequest["kind"];

interface Input {
  kind: GoalKind;
  onCreate: (goal: CreateGoalRequest) => Promise<unknown>;
  onDone: () => void;
}

/** Checks the form with the contract schema, sends it, and maps failures to field messages. */
export function useGoalForm({ kind, onCreate, onDone }: Input) {
  const { t } = useLocale();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget; // React clears currentTarget after the await below
    const parsed = createGoalRequestSchema.safeParse({
      ...Object.fromEntries(new FormData(form)),
      kind,
    });
    if (!parsed.success) {
      const message = (f: string) =>
        t(f === "name" ? "goals.invalid.name" : `goals.invalid.${kind}`);
      const fields = parsed.error.issues.map((issue) => String(issue.path[0]));
      setErrors(Object.fromEntries(fields.map((f) => [f, message(f)])));
      return;
    }
    setPending(true);
    try {
      await onCreate(parsed.data);
      form.reset();
      setErrors({});
      onDone();
    } catch (error) {
      const limit = error instanceof ApiError && error.code === "GOAL_LIMIT_REACHED";
      setErrors({ form: limit ? t("goals.limit") : t("state.error.body") });
    } finally {
      setPending(false);
    }
  };
  return { errors, pending, submit };
}
