import { Building2, FolderOpen } from "lucide-react";
import { Link } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, StatePanel } from "../../shared/ui";
import { NewProjectLink } from "./new-project-link";

const LINK = "flex min-h-11 items-center font-medium underline-offset-4 hover:underline";

interface Props {
  org: { id: string; name: string };
  projects: readonly { id: string; name: string }[];
  /** Owner or admin: "New project" and the organization settings. */
  admin: boolean;
}

/** One organization on `/projects`: its projects the user can open. */
export function OrgCard({ org, projects, admin }: Props) {
  const { t } = useLocale();
  return (
    <Card labelledBy={`org-${org.id}`}>
      <CardHeader
        id={`org-${org.id}`}
        icon={Building2}
        title={org.name}
        action={admin && <NewProjectLink organizationId={org.id} />}
      />
      {projects.length === 0 ? (
        <StatePanel
          icon={FolderOpen}
          title={t("projects.empty.title")}
          body={t("projects.empty.body")}
        />
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}/overview`} className={LINK}>
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {admin && (
        <Link to={`/organizations/${org.id}/settings`} className={`${LINK} mt-2 text-accent-text`}>
          {t("menu.orgSettings")}
        </Link>
      )}
    </Card>
  );
}
