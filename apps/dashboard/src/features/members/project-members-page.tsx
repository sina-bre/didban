import { Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, StatePanel, useToast } from "../../shared/ui";
import { useProject } from "../projects/use-project";
import { useOrgRole } from "../projects/use-projects";
import { QueryBlock } from "../report/query-block";
import { failureText } from "../settings/failure-text";
import { AssignMemberForm } from "./assign-member-form";
import { ProjectMembersTable } from "./project-members-table";
import { type ProjectRole, useProjectMembers } from "./use-project-members";

/** Who besides org owners/admins may open this project, and as what (spec §11). */
export function ProjectMembersPage() {
  const { t } = useLocale();
  const notify = useToast();
  const projectId = useParams().projectId ?? "";
  const project = useProject(projectId).data;
  const role = useOrgRole(project?.organizationId);
  const { list, assign, remove } = useProjectMembers(projectId);
  const [error, setError] = useState<string>();
  const change = async (userId: string, next: ProjectRole) => {
    try {
      await assign.mutateAsync({ userId, role: next });
      setError(undefined);
      notify(t("settings.saved"));
    } catch (failure) {
      setError(failureText(t, failure));
    }
  };
  return (
    <Card labelledBy="members-title">
      <CardHeader id="members-title" icon={Users} title={t("settings.members")} />
      <p className="mb-4 max-w-prose text-body text-muted">{t("members.projectIntro")}</p>
      <QueryBlock query={list} skeleton="h-40">
        {(data) =>
          data.members.length === 0 ? (
            <StatePanel
              icon={Users}
              title={t("members.none.title")}
              body={t("members.none.body")}
            />
          ) : (
            <ProjectMembersTable
              members={data.members}
              onRole={(m, next) => void change(m.userId, next)}
              onRemove={(m) => remove.mutateAsync(m.userId)}
            />
          )
        }
      </QueryBlock>
      {error && (
        <p role="alert" className="mt-4 text-body text-down">
          {error}
        </p>
      )}
      <AssignMemberForm
        candidates={list.data?.candidates ?? []}
        pending={assign.isPending}
        onAssign={(userId, next) => void change(userId, next)}
      />
      {(role === "owner" || role === "admin") && project && (
        <Link
          to={`/organizations/${project.organizationId}/settings/members`}
          className="mt-4 inline-flex min-h-11 items-center font-medium text-accent-text underline"
        >
          {t("members.orgLink")}
        </Link>
      )}
    </Card>
  );
}
