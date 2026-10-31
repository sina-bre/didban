import type { Project } from "@didban/contracts";
import { ShieldCheck } from "lucide-react";
import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField, Switch, TextField } from "../../shared/ui";
import { useProject } from "../projects/use-project";
import { useOrgRole } from "../projects/use-projects";
import { ArchiveProject } from "./archive-project";
import { ProjectForm } from "./project-form";
import type { FormErrors } from "./use-settings-form";

const FIELDS = {
  retentionDays: "optionalNumber",
  piiGuard: "text",
  storeCity: "bool",
  urlParamAllowlist: "list",
  siteSearchParams: "list",
} as const;

/** What is kept and for how long (spec §12 privacy controls), and archiving the project. */
export function DataSettingsPage() {
  const { t } = useLocale();
  const project = useProject(useParams().projectId ?? "").data;
  const role = useOrgRole(project?.organizationId);
  return (
    <>
      <ProjectForm id="data-title" icon={ShieldCheck} title={t("settings.data")} fields={FIELDS}>
        {(p, errors) => <DataFields project={p} errors={errors} />}
      </ProjectForm>
      {project && (role === "owner" || role === "admin") && <ArchiveProject project={project} />}
    </>
  );
}

function DataFields({ project, errors }: { project: Project; errors: FormErrors }) {
  const { t } = useLocale();
  return (
    <>
      <TextField
        label={t("settings.retention")}
        hint={t("settings.retentionHint")}
        name="retentionDays"
        type="number"
        min={7}
        max={3650}
        defaultValue={project.retentionDays ?? ""}
        error={errors.retentionDays}
      />
      <SelectField
        label={t("settings.piiGuard")}
        hint={t("settings.piiGuardHint")}
        name="piiGuard"
        defaultValue={project.piiGuard}
      >
        <option value="strip">{t("settings.piiGuard.strip")}</option>
        <option value="off">{t("settings.piiGuard.off")}</option>
      </SelectField>
      <Switch label={t("settings.storeCity")} name="storeCity" defaultChecked={project.storeCity} />
      <TextField
        label={t("settings.urlParams")}
        hint={t("settings.urlParamsHint")}
        name="urlParamAllowlist"
        dir="ltr"
        defaultValue={project.urlParamAllowlist.join(", ")}
        error={errors.urlParamAllowlist}
      />
      <TextField
        label={t("settings.siteSearch")}
        hint={t("settings.siteSearchHint")}
        name="siteSearchParams"
        dir="ltr"
        defaultValue={project.siteSearchParams.join(", ")}
        error={errors.siteSearchParams}
      />
    </>
  );
}
