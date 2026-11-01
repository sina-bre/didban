import { type CreateDataDeletionRequest, createDataDeletionRequestSchema } from "@didban/contracts";
import { useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { addDays, parseDay, startOf } from "../../shared/lib/zoned-day";
import { Segmented } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";
import { DeletionFields } from "./deletion-fields";

type Kind = CreateDataDeletionRequest["kind"];
const KINDS: readonly Kind[] = ["range", "visitor", "user"];
const FIELDS = { from: "text", to: "text", anonymousId: "text", userId: "text" } as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` day (+ `offset` days) → the instant it starts in the project's zone. */
const dayStart = (day: unknown, timeZone: string, offset = 0) =>
  typeof day === "string" && DAY.test(day)
    ? startOf(addDays(parseDay(day), offset), timeZone).toISOString()
    : "";

interface Props {
  timeZone: string;
  /** Called with a checked request; the caller confirms before sending it. */
  onRequest: (body: CreateDataDeletionRequest) => void;
}

/** What to delete: whole days in the project's zone (both included), a visitor or a user ID. */
export function DeletionForm({ timeZone, onRequest }: Props) {
  const { t } = useLocale();
  const [kind, setKind] = useState<Kind>("range");
  const form = useSettingsForm({
    fields: FIELDS,
    schema: createDataDeletionRequestSchema,
    send: async (body) => onRequest(body),
    prepare: (raw) => {
      if (kind === "visitor") return { kind, anonymousId: raw.anonymousId };
      if (kind === "user") return { kind, userId: raw.userId };
      return { kind, from: dayStart(raw.from, timeZone), to: dayStart(raw.to, timeZone, 1) };
    },
    invalid: (field) =>
      t(field === "from" || field === "to" ? "deletion.invalid.range" : "deletion.invalid.id"),
  });
  const options = KINDS.map((value) => ({ value, label: t(`deletion.kind.${value}`) }));
  return (
    <form
      noValidate
      onSubmit={(e) => void form.onSubmit(e)}
      className="mt-4 flex max-w-xl flex-col gap-4"
    >
      <Segmented label={t("deletion.kind")} value={kind} options={options} onChange={setKind} />
      <DeletionFields kind={kind} errors={form.errors} />
      <FormFooter error={form.errors.form} pending={form.pending} label={t("deletion.submit")} />
    </form>
  );
}
