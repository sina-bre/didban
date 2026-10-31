import type { ProjectMemberListResponse } from "@didban/contracts";
import { ConfirmAction } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable, SelectField } from "../../shared/ui";
import { failureText } from "../settings/failure-text";
import type { ProjectRole } from "./use-project-members";

type Member = ProjectMemberListResponse["members"][number];

interface Props {
  members: readonly Member[];
  onRole: (member: Member, role: ProjectRole) => void;
  onRemove: (member: Member) => Promise<unknown>;
}

/** Assigned members with their project role (changeable in place) and a remove action. */
export function ProjectMembersTable({ members, onRole, onRemove }: Props) {
  const { t } = useLocale();
  const columns: Column<Member>[] = [
    { key: "email", header: t("members.email"), cell: (m) => <bdi dir="ltr">{m.email}</bdi> },
    {
      key: "role",
      header: t("members.role"),
      cell: (m) => (
        <SelectField
          label={t("members.roleOf", { email: m.email })}
          hideLabel
          value={m.role}
          onChange={(e) => onRole(m, e.currentTarget.value as ProjectRole)}
        >
          <option value="viewer">{t("role.viewer")}</option>
          <option value="project_admin">{t("role.project_admin")}</option>
        </SelectField>
      ),
    },
    {
      key: "remove",
      header: t("goals.actions"),
      cell: (m) => (
        <ConfirmAction
          label={t("members.remove")}
          name={t("members.removeName", { email: m.email })}
          title={t("members.removeTitle", { email: m.email })}
          body={t("members.removeProjectBody")}
          confirm={t("members.remove")}
          onConfirm={() => onRemove(m)}
          failure={(error) => failureText(t, error)}
        />
      ),
    },
  ];
  return (
    <DataTable
      caption={t("settings.members")}
      columns={columns}
      rows={members}
      rowKey={(m) => m.userId}
    />
  );
}
