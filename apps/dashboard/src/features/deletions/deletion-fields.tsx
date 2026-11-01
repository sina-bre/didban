import type { CreateDataDeletionRequest } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { TextField } from "../../shared/ui";
import type { FormErrors } from "../settings/use-settings-form";

const id = { dir: "ltr", required: true, maxLength: 128 } as const;

/** The inputs of one deletion kind. */
export function DeletionFields({
  kind,
  errors,
}: {
  kind: CreateDataDeletionRequest["kind"];
  errors: FormErrors;
}) {
  const { t } = useLocale();
  return (
    <>
      {kind === "range" && (
        <div className="flex flex-col gap-4 md:flex-row">
          <TextField
            label={t("deletion.from")}
            hint={t("deletion.rangeHint")}
            name="from"
            type="date"
            required
            error={errors.from}
          />
          <TextField label={t("deletion.to")} name="to" type="date" required error={errors.to} />
        </div>
      )}
      {kind === "visitor" && (
        <TextField
          label={t("deletion.anonymousId")}
          hint={t("deletion.anonymousIdHint")}
          name="anonymousId"
          {...id}
          error={errors.anonymousId}
        />
      )}
      {kind === "user" && (
        <TextField
          label={t("deletion.userId")}
          hint={t("deletion.userIdHint")}
          name="userId"
          {...id}
          error={errors.userId}
        />
      )}
    </>
  );
}
