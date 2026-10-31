import { type CreatedUser, createUserRequestSchema } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField, TextField } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";
import type { useOrgMembers } from "./use-org-members";

interface Props {
  create: ReturnType<typeof useOrgMembers>["create"];
  /** Admins create plain members only (ADR 0024); owners any role. */
  isOwner: boolean;
  onCreated: (user: CreatedUser) => void;
}

/** New account in this organization; the server answers with a one-time temporary password. */
export function CreateUserForm({ create, isOwner, onCreated }: Props) {
  const { t } = useLocale();
  const form = useSettingsForm({
    fields: { email: "text", role: "text" },
    schema: createUserRequestSchema,
    send: async (body) => onCreated(await create.mutateAsync(body)),
    invalid: () => t("members.invalidEmail"),
    onDone: (el) => el.reset(),
  });
  const roles = isOwner ? (["member", "admin", "owner"] as const) : (["member"] as const);
  return (
    <form
      noValidate
      onSubmit={(e) => void form.onSubmit(e)}
      className="flex max-w-xl flex-col gap-4"
    >
      <TextField
        label={t("members.email")}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="off"
        required
        error={form.errors.email}
      />
      <SelectField label={t("members.role")} name="role" error={form.errors.role}>
        {roles.map((role) => (
          <option key={role} value={role}>
            {t(`role.${role}`)}
          </option>
        ))}
      </SelectField>
      <FormFooter error={form.errors.form} pending={form.pending} label={t("members.create")} />
    </form>
  );
}
