import type { OrganizationMember } from "@didban/contracts";
import { ConfirmAction } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { failureText } from "../settings/failure-text";

interface Props {
  member: OrganizationMember;
  onReset: (member: OrganizationMember) => Promise<unknown>;
  onRemove: (member: OrganizationMember) => Promise<unknown>;
}

/** Owner actions on one member: a new temporary password, or removal from the organization. */
export function MemberActions({ member: m, onReset, onRemove }: Props) {
  const { t } = useLocale();
  const fail = (error: unknown) => failureText(t, error);
  return (
    <span className="flex flex-wrap gap-2">
      <ConfirmAction
        label={t("members.reset")}
        name={t("members.resetName", { email: m.email })}
        title={t("members.resetTitle", { email: m.email })}
        body={t("members.resetBody")}
        confirm={t("members.reset")}
        onConfirm={() => onReset(m)}
        failure={fail}
      />
      <ConfirmAction
        label={t("members.remove")}
        name={t("members.removeName", { email: m.email })}
        title={t("members.removeTitle", { email: m.email })}
        body={t("members.removeOrgBody")}
        confirm={t("members.remove")}
        onConfirm={() => onRemove(m)}
        failure={fail}
      />
    </span>
  );
}
