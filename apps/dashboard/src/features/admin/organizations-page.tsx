import type { AdminOrganization, CreatedUser } from "@didban/contracts";
import { Building2 } from "lucide-react";
import { useRef, useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, Dialog } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { AdminOrgsTable } from "./admin-orgs-table";
import { CreateOrgForm } from "./create-org-form";
import { OwnerForm } from "./owner-form";
import { useAdminOrganizations } from "./use-admin";

/** `/admin/organizations`: create organizations, give them an owner, suspend them. */
export function AdminOrganizationsPage() {
  const { t } = useLocale();
  const { list, create, suspend, createOwner } = useAdminOrganizations();
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<AdminOrganization | null>(null);
  const [owner, setOwner] = useState<CreatedUser | null>(null);
  const openOwner = (org: AdminOrganization) => {
    setTarget(org);
    setOwner(null);
    dialog.current?.showModal();
  };
  return (
    <>
      <Card labelledBy="admin-orgs-title">
        <CardHeader id="admin-orgs-title" icon={Building2} title={t("admin.organizations")} />
        <QueryBlock query={list} skeleton="h-40">
          {(data) => (
            <AdminOrgsTable
              organizations={data.organizations}
              onSuspend={(org, suspended) => suspend.mutateAsync({ id: org.id, suspended })}
              onOwner={openOwner}
            />
          )}
        </QueryBlock>
        <CreateOrgForm onCreate={create.mutateAsync} />
      </Card>
      <Dialog
        ref={dialog}
        title={t("admin.ownerFor", { name: target?.name ?? "" })}
        closeLabel={t("more.close")}
        onClose={() => setOwner(null)}
      >
        {target && (
          <OwnerForm
            key={target.id}
            created={owner}
            onCreate={async (email) =>
              setOwner(await createOwner.mutateAsync({ id: target.id, email }))
            }
          />
        )}
      </Dialog>
    </>
  );
}
