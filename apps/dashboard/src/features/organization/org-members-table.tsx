import type { OrganizationMember } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable, SelectField, Tag } from "../../shared/ui";
import { MemberActions } from "./member-actions";
import type { OrgRole } from "./use-org-members";

interface Props {
  members: readonly OrganizationMember[];
  /** Owners only (`org:roles`): role changes, password resets, removal. */
  isOwner: boolean;
  onRole: (member: OrganizationMember, role: OrgRole) => void;
  onReset: (member: OrganizationMember) => Promise<unknown>;
  onRemove: (member: OrganizationMember) => Promise<unknown>;
}

const ROLES = ["owner", "admin", "member"] as const;

/** Members with role and first-login state; owners get the actions. */
export function OrgMembersTable({ members, isOwner, onRole, onReset, onRemove }: Props) {
  const { t } = useLocale();
  const role = (m: OrganizationMember) =>
    isOwner ? (
      <SelectField
        label={t("members.roleOf", { email: m.email })}
        hideLabel
        value={m.role}
        onChange={(e) => onRole(m, e.currentTarget.value as OrgRole)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role.${r}`)}
          </option>
        ))}
      </SelectField>
    ) : (
      t(`role.${m.role}`)
    );
  const columns: Column<OrganizationMember>[] = [
    {
      key: "email",
      header: t("members.email"),
      cell: (m) => (
        <span className="flex flex-wrap items-center gap-2">
          <bdi dir="ltr">{m.email}</bdi>
          {m.mustChangePassword && <Tag>{t("members.temporary")}</Tag>}
        </span>
      ),
    },
    { key: "role", header: t("members.role"), cell: role },
  ];
  if (isOwner) {
    columns.push({
      key: "actions",
      header: t("goals.actions"),
      cell: (m) => <MemberActions member={m} onReset={onReset} onRemove={onRemove} />,
    });
  }
  return (
    <DataTable
      caption={t("org.members")}
      columns={columns}
      rows={members}
      rowKey={(m) => m.userId}
    />
  );
}
