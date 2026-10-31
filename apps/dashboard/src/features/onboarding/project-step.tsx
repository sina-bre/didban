import {
  type CreateProjectRequest,
  createProjectRequestSchema,
  type Project,
} from "@didban/contracts";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField, TextField } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { TimeZoneField } from "../settings/time-zone-field";
import { useSettingsForm } from "../settings/use-settings-form";
import { useCreateProject } from "./use-create-project";

interface Props {
  organizations: readonly { id: string; name: string }[];
  onCreated: (project: Project) => void;
}

/** Step 1: name, reporting zone (the browser's by default) and, with several, the organization. */
export function ProjectStep({ organizations, onCreated }: Props) {
  const { t } = useLocale();
  const create = useCreateProject();
  const preset = useSearchParams()[0].get("org");
  const fallback = organizations.some((o) => o.id === preset) ? preset : organizations[0]?.id;
  const [organizationId, setOrganizationId] = useState(fallback ?? "");
  const form = useSettingsForm({
    fields: { name: "text", reportingTimezone: "text" },
    schema: createProjectRequestSchema,
    send: async (body: CreateProjectRequest) =>
      onCreated(await create.mutateAsync({ organizationId, body })),
    invalid: () => t("wizard.invalidName"),
  });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <form
      noValidate
      onSubmit={(e) => void form.onSubmit(e)}
      className="flex max-w-xl flex-col gap-4"
    >
      {organizations.length > 1 && (
        <SelectField
          label={t("wizard.organization")}
          value={organizationId}
          onChange={(e) => setOrganizationId(e.currentTarget.value)}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label={t("wizard.projectName")}
        hint={t("wizard.projectHint")}
        name="name"
        required
        maxLength={100}
        error={form.errors.name}
      />
      <TimeZoneField defaultValue={zone} error={form.errors.reportingTimezone} />
      <FormFooter
        error={form.errors.form}
        pending={form.pending}
        label={t("wizard.createProject")}
      />
    </form>
  );
}
