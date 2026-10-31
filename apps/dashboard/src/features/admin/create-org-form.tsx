import { createOrganizationRequestSchema } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { TextField, useToast } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";

/** A new organization by name (platform admins); its owner is created afterwards. */
export function CreateOrgForm({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
  const { t } = useLocale();
  const notify = useToast();
  const form = useSettingsForm({
    fields: { name: "text" },
    schema: createOrganizationRequestSchema,
    send: (body) => onCreate(body.name),
    invalid: () => t("admin.invalidName"),
    onDone: (el) => {
      el.reset();
      notify(t("admin.created"));
    },
  });
  return (
    <form
      noValidate
      onSubmit={(e) => void form.onSubmit(e)}
      className="mt-4 flex max-w-xl flex-col gap-4"
    >
      <TextField
        label={t("admin.orgName")}
        name="name"
        required
        maxLength={100}
        error={form.errors.name}
      />
      <FormFooter error={form.errors.form} pending={form.pending} label={t("admin.create")} />
    </form>
  );
}
