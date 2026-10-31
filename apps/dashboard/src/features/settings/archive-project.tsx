import type { Project } from "@didban/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { useNavigate } from "react-router";
import { ConfirmAction } from "../../shared/components";
import { api } from "../../shared/lib/api-client";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader } from "../../shared/ui";
import { failureText } from "./failure-text";

/**
 * Org owners/admins archive a project (`org:projects`): it leaves every list and stops taking
 * events; its data stays until the retention job removes it.
 */
export function ArchiveProject({ project }: { project: Project }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const client = useQueryClient();
  const archive = useMutation({
    mutationFn: () =>
      api(`/organizations/${project.organizationId}/projects/${project.id}`, {
        method: "PATCH",
        body: { archived: true },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["switcher"] });
      client.removeQueries({ queryKey: ["project", project.id] });
      await navigate("/projects", { replace: true });
    },
  });
  return (
    <Card labelledBy="archive-title">
      <CardHeader id="archive-title" icon={Archive} title={t("settings.archive")} />
      <p className="mb-4 max-w-prose text-body text-muted">{t("settings.archiveBody")}</p>
      <ConfirmAction
        label={t("settings.archive")}
        title={t("settings.archiveTitle", { name: project.name })}
        body={t("settings.archiveBody")}
        confirm={t("settings.archiveConfirm")}
        onConfirm={() => archive.mutateAsync()}
        failure={(error) => failureText(t, error)}
      />
    </Card>
  );
}
