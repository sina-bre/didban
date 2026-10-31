import { type Project, updateProjectRequestSchema } from "@didban/contracts";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, useToast } from "../../shared/ui";
import { useProject } from "../projects/use-project";
import { FormFooter } from "./form-footer";
import type { FieldKind } from "./read-form";
import { useProjectUpdate } from "./use-project-update";
import { type FormErrors, useSettingsForm } from "./use-settings-form";

interface Props {
  id: string;
  icon: LucideIcon;
  title: string;
  fields: Record<string, FieldKind>;
  children: (project: Project, errors: FormErrors) => ReactNode;
}

/** A card with project settings fields, saved with `PATCH /projects/:id` (General, Data). */
export function ProjectForm({ id, icon, title, fields, children }: Props) {
  const { t } = useLocale();
  const notify = useToast();
  const projectId = useParams().projectId ?? "";
  const project = useProject(projectId).data;
  const update = useProjectUpdate(projectId);
  const form = useSettingsForm({
    fields,
    schema: updateProjectRequestSchema,
    send: update.mutateAsync,
    invalid: () => t("settings.invalid"),
    onDone: () => notify(t("settings.saved")),
  });
  if (!project) return null;
  return (
    <Card labelledBy={id}>
      <CardHeader id={id} icon={icon} title={title} />
      <form
        noValidate
        onSubmit={(e) => void form.onSubmit(e)}
        className="flex max-w-xl flex-col gap-4"
      >
        {children(project, form.errors)}
        <FormFooter error={form.errors.form} pending={form.pending} />
      </form>
    </Card>
  );
}
