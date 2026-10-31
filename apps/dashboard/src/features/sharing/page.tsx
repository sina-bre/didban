import type { CreatedShareLink, CreateShareLinkRequest } from "@didban/contracts";
import { Link2 } from "lucide-react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { SecretOnce } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, Dialog, StatePanel } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { ShareForm } from "./share-form";
import { SharesTable } from "./shares-table";
import { shareUrl, useShares } from "./use-shares";

/** Public read-only links to this project's reports (spec §3.1): revocable, optional expiry. */
export function SharingPage() {
  const { t } = useLocale();
  const projectId = useParams().projectId ?? "";
  const { list, create, revoke } = useShares(projectId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [created, setCreated] = useState<CreatedShareLink | null>(null);
  const onCreate = async (body: CreateShareLinkRequest) => {
    setCreated(await create.mutateAsync(body));
    dialog.current?.showModal();
  };
  return (
    <>
      <Card labelledBy="share-title">
        <CardHeader id="share-title" icon={Link2} title={t("settings.sharing")} />
        <p className="mb-4 max-w-prose text-body text-muted">{t("share.intro")}</p>
        <QueryBlock query={list} skeleton="h-40">
          {(data) =>
            data.shareLinks.length === 0 ? (
              <StatePanel icon={Link2} title={t("share.none.title")} body={t("share.none.body")} />
            ) : (
              <SharesTable links={data.shareLinks} onRevoke={(l) => revoke.mutateAsync(l.id)} />
            )
          }
        </QueryBlock>
        <ShareForm onCreate={onCreate} />
      </Card>
      <Dialog
        ref={dialog}
        title={t("share.created")}
        closeLabel={t("more.close")}
        onClose={() => setCreated(null)}
      >
        {created && <SecretOnce title={created.label} secret={shareUrl(created.token)} />}
      </Dialog>
    </>
  );
}
