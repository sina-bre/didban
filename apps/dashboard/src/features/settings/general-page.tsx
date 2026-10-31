import type { Project } from "@didban/contracts";
import { SlidersHorizontal } from "lucide-react";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField, Switch, TextField } from "../../shared/ui";
import { ProjectForm } from "./project-form";
import { TimeZoneField } from "./time-zone-field";
import type { FormErrors } from "./use-settings-form";

const FIELDS = {
  name: "text",
  reportingTimezone: "text",
  sessionTimeoutMinutes: "number",
  trailingSlashPolicy: "text",
  hashRouting: "bool",
  allowIdentify: "bool",
} as const;

/** Name, reporting zone, visits and URL handling (spec §9.1 project settings). */
export function GeneralSettingsPage() {
  const { t } = useLocale();
  return (
    <ProjectForm
      id="general-title"
      icon={SlidersHorizontal}
      title={t("settings.general")}
      fields={FIELDS}
    >
      {(project, errors) => <GeneralFields project={project} errors={errors} />}
    </ProjectForm>
  );
}

function GeneralFields({ project, errors }: { project: Project; errors: FormErrors }) {
  const { t } = useLocale();
  return (
    <>
      <TextField
        label={t("settings.name")}
        name="name"
        defaultValue={project.name}
        required
        maxLength={100}
        error={errors.name}
      />
      <TimeZoneField defaultValue={project.reportingTimezone} error={errors.reportingTimezone} />
      <TextField
        label={t("settings.sessionTimeout")}
        hint={t("settings.sessionTimeoutHint")}
        name="sessionTimeoutMinutes"
        type="number"
        min={5}
        max={120}
        defaultValue={project.sessionTimeoutMinutes}
        error={errors.sessionTimeoutMinutes}
      />
      <SelectField
        label={t("settings.trailingSlash")}
        name="trailingSlashPolicy"
        defaultValue={project.trailingSlashPolicy}
      >
        <option value="strip">{t("settings.trailingSlash.strip")}</option>
        <option value="keep">{t("settings.trailingSlash.keep")}</option>
      </SelectField>
      <Switch
        label={t("settings.hashRouting")}
        name="hashRouting"
        defaultChecked={project.hashRouting}
      />
      <Switch
        label={t("settings.allowIdentify")}
        name="allowIdentify"
        defaultChecked={project.allowIdentify}
      />
    </>
  );
}
