import { type CreatedUser, createOwnerRequestSchema } from "@didban/contracts";
import { SecretOnce } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { TextField } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";

interface Props {
  /** The owner just created: their one-time temporary password replaces the form. */
  created: CreatedUser | null;
  onCreate: (email: string) => Promise<unknown>;
}

/** A platform admin gives an organization an owner (ADR 0024: temporary password, shown once). */
export function OwnerForm({ created, onCreate }: Props) {
  const { t } = useLocale();
  const form = useSettingsForm({
    fields: { email: "text" },
    schema: createOwnerRequestSchema,
    send: (body) => onCreate(body.email),
    invalid: () => t("members.invalidEmail"),
  });
  if (created) {
    return (
      <SecretOnce
        title={t("members.passwordFor", { email: created.email })}
        secret={created.temporaryPassword}
      />
    );
  }
  return (
    <form noValidate onSubmit={(e) => void form.onSubmit(e)} className="flex flex-col gap-4">
      <TextField
        label={t("members.email")}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="off"
        required
        error={form.errors.email}
      />
      <FormFooter error={form.errors.form} pending={form.pending} label={t("admin.owner")} />
    </form>
  );
}
