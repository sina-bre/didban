import type { OrganizationProjectListResponse } from "@didban/contracts";
import { FolderOpen } from "lucide-react";
import { Link, useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Card, CardHeader, type Column, DataTable, Tag } from "../../shared/ui";
import { NewProjectLink } from "../projects/new-project-link";
import { QueryBlock } from "../report/query-block";
import { useOrgProjects } from "./use-org-projects";

type Row = OrganizationProjectListResponse["projects"][number];

const LINK = "inline-flex min-h-11 items-center font-medium text-accent-text underline";

/** The organization's projects; archived ones can be restored (org owners and admins). */
export function OrgProjectsPage() {
  const { t } = useLocale();
  const organizationId = useParams().organizationId ?? "";
  const { list, restore } = useOrgProjects(organizationId);
  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("settings.name"),
      cell: (p) =>
        p.archivedAt ? (
          <span className="flex items-center gap-2">
            {p.name} <Tag>{t("org.archived")}</Tag>
          </span>
        ) : (
          <Link className={LINK} to={`/projects/${p.id}/overview`}>
            {p.name}
          </Link>
        ),
    },
    {
      key: "action",
      header: t("goals.actions"),
      cell: (p) =>
        p.archivedAt ? (
          <Button disabled={restore.isPending} onClick={() => restore.mutate(p.id)}>
            {t("org.restore")}
          </Button>
        ) : (
          <Link className={LINK} to={`/projects/${p.id}/settings/general`}>
            {t("menu.projectSettings")}
          </Link>
        ),
    },
  ];
  return (
    <Card labelledBy="org-projects-title">
      <CardHeader
        id="org-projects-title"
        icon={FolderOpen}
        title={t("org.projects")}
        action={<NewProjectLink organizationId={organizationId} />}
      />
      <QueryBlock query={list} skeleton="h-40">
        {(data) => (
          <DataTable
            caption={t("org.projects")}
            columns={columns}
            rows={data.projects}
            rowKey={(p) => p.id}
          />
        )}
      </QueryBlock>
    </Card>
  );
}
