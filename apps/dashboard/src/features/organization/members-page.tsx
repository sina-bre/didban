import { UserPlus, Users } from "lucide-react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { SecretOnce } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, Dialog, useToast } from "../../shared/ui";
import { useOrgRole } from "../projects/use-projects";
import { QueryBlock } from "../report/query-block";
import { failureText } from "../settings/failure-text";
import { CreateUserForm } from "./create-user-form";
import { OrgMembersTable } from "./org-members-table";
import { type OrgRole, useOrgMembers } from "./use-org-members";

/** `/organizations/:id/settings/members`: accounts, roles, temporary passwords (ADR 0024). */
export function OrgMembersPage() {
  const { t } = useLocale();
  const notify = useToast();
  const organizationId = useParams().organizationId ?? "";
  const isOwner = useOrgRole(organizationId) === "owner";
  const members = useOrgMembers(organizationId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string>();
  const show = (email: string, password: string) => {
    setSecret({ email, password });
    dialog.current?.showModal();
  };
  const changeRole = async (userId: string, role: OrgRole) => {
    try {
      await members.changeRole.mutateAsync({ userId, role });
      setError(undefined);
      notify(t("settings.saved"));
    } catch (failure) {
      setError(failureText(t, failure));
    }
  };
  return (
    <>
      <Card labelledBy="org-members-title">
        <CardHeader id="org-members-title" icon={Users} title={t("org.members")} />
        <QueryBlock query={members.list} skeleton="h-40">
          {(data) => (
            <OrgMembersTable
              members={data.members}
              isOwner={isOwner}
              onRole={(m, role) => void changeRole(m.userId, role)}
              onReset={async (m) =>
                show(m.email, (await members.resetPassword.mutateAsync(m.userId)).temporaryPassword)
              }
              onRemove={(m) => members.remove.mutateAsync(m.userId)}
            />
          )}
        </QueryBlock>
        {error && (
          <p role="alert" className="mt-4 text-body text-down">
            {error}
          </p>
        )}
      </Card>
      <Card labelledBy="new-user-title">
        <CardHeader id="new-user-title" icon={UserPlus} title={t("members.create")} />
        <p className="mb-4 max-w-prose text-body text-muted">{t("members.createIntro")}</p>
        <CreateUserForm
          create={members.create}
          isOwner={isOwner}
          onCreated={(user) => show(user.email, user.temporaryPassword)}
        />
      </Card>
      <Dialog
        ref={dialog}
        title={t("members.passwordFor", { email: secret?.email ?? "" })}
        closeLabel={t("more.close")}
        onClose={() => setSecret(null)}
      >
        {secret && <SecretOnce title={t("members.temporaryPassword")} secret={secret.password} />}
      </Dialog>
    </>
  );
}
