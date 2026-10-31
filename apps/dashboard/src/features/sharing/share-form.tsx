import { type CreateShareLinkRequest, createShareLinkRequestSchema } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { TextField } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";

/** A date field's day → the end of that day in this browser's zone, as UTC ISO. */
const endOfDay = (day: unknown) =>
  typeof day === "string" && day !== "" ? new Date(`${day}T23:59:59`).toISOString() : undefined;

/** Label and optional expiry day of a new share link. */
export function ShareForm({
  onCreate,
}: {
  onCreate: (body: CreateShareLinkRequest) => Promise<unknown>;
}) {
  const { t } = useLocale();
  const form = useSettingsForm({
    fields: { label: "text", expiresAt: "text" },
    schema: createShareLinkRequestSchema,
    send: onCreate,
    prepare: (raw) => ({ ...raw, expiresAt: endOfDay(raw.expiresAt) }),
    invalid: (field) => t(field === "expiresAt" ? "share.invalid.expires" : "share.invalid.label"),
    onDone: (el) => el.reset(),
  });
  return (
    <form
      noValidate
      onSubmit={(e) => void form.onSubmit(e)}
      className="mt-4 flex max-w-xl flex-col gap-4"
    >
      <TextField
        label={t("share.label")}
        hint={t("share.labelHint")}
        name="label"
        required
        maxLength={100}
        error={form.errors.label}
      />
      <TextField
        label={t("share.expiresOn")}
        hint={t("share.expiresHint")}
        name="expiresAt"
        type="date"
        error={form.errors.expiresAt}
      />
      <FormFooter error={form.errors.form} pending={form.pending} label={t("share.create")} />
    </form>
  );
}
