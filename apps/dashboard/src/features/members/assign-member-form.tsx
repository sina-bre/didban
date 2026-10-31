import type { FormEvent } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import type { ProjectRole } from "./use-project-members";

interface Props {
  candidates: readonly { userId: string; email: string }[];
  pending: boolean;
  onAssign: (userId: string, role: ProjectRole) => void;
}

/** Give an organization member (without a project role yet) access to this project. */
export function AssignMemberForm({ candidates, pending, onAssign }: Props) {
  const { t } = useLocale();
  if (candidates.length === 0) return null;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAssign(String(data.get("userId")), String(data.get("role")) as ProjectRole);
  };
  return (
    <form onSubmit={submit} className="mt-4 flex max-w-xl flex-col gap-4">
      <SelectField label={t("members.person")} name="userId" dir="ltr">
        {candidates.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.email}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("members.role")} name="role">
        <option value="viewer">{t("role.viewer")}</option>
        <option value="project_admin">{t("role.project_admin")}</option>
      </SelectField>
      <FormFooter pending={pending} label={t("members.give")} />
    </form>
  );
}
