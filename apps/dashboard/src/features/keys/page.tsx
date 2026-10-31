import type { ApiKeyKind, CreatedApiKey } from "@didban/contracts";
import { KeyRound } from "lucide-react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, Dialog, StatePanel } from "../../shared/ui";
import { useEnvironments } from "../environments/use-environments";
import { IntegrationPanel } from "../integration/integration-panel";
import { LiveCheck } from "../integration/live-check";
import { QueryBlock } from "../report/query-block";
import { CreateKeyForm } from "./create-key-form";
import { KeysTable } from "./keys-table";
import { useKeys } from "./use-keys";

/** Write keys: create one per environment (shown once with its snippets), revoke old ones. */
export function KeysPage() {
  const { t } = useLocale();
  const projectId = useParams().projectId ?? "";
  const { list, create, revoke } = useKeys(projectId);
  const environments = useEnvironments(projectId).list.data?.environments ?? [];
  const dialog = useRef<HTMLDialogElement>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const onCreate = async (input: { environmentId: string; kind: ApiKeyKind }) => {
    setCreated(await create.mutateAsync(input));
    dialog.current?.showModal();
  };
  const name = (id: string) => environments.find((env) => env.id === id)?.name ?? "—";
  const createdEnv = environments.find((env) => env.id === created?.environmentId);
  return (
    <>
      <Card labelledBy="keys-title">
        <CardHeader id="keys-title" icon={KeyRound} title={t("settings.keys")} />
        <QueryBlock query={list} skeleton="h-40">
          {(data) =>
            data.keys.length === 0 ? (
              <StatePanel icon={KeyRound} title={t("keys.none.title")} body={t("keys.none.body")} />
            ) : (
              <KeysTable
                keys={data.keys}
                environmentName={name}
                onRevoke={(k) => revoke.mutateAsync(k.id)}
              />
            )
          }
        </QueryBlock>
      </Card>
      <Card labelledBy="new-key-title">
        <CardHeader id="new-key-title" icon={KeyRound} title={t("keys.create")} />
        <CreateKeyForm environments={environments} pending={create.isPending} onCreate={onCreate} />
      </Card>
      <Dialog
        ref={dialog}
        title={t("keys.created")}
        closeLabel={t("more.close")}
        onClose={() => setCreated(null)}
      >
        {created && <IntegrationPanel kind={created.kind} token={created.token} />}
        {created?.kind === "write_browser" && createdEnv && (
          <div className="mt-4">
            <LiveCheck projectId={projectId} environment={createdEnv} />
          </div>
        )}
      </Dialog>
    </>
  );
}
