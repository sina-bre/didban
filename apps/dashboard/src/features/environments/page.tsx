import type { Environment } from "@didban/contracts";
import { Layers, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Card, CardHeader, Dialog, StatePanel, useToast } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { EnvironmentForm } from "./environment-form";
import { EnvironmentRow } from "./environment-row";
import { useEnvironments } from "./use-environments";

/** Environments of the project (`production`, `staging`, …): where each may send events from. */
export function EnvironmentsPage() {
  const { t } = useLocale();
  const notify = useToast();
  const projectId = useParams().projectId ?? "";
  const { list, create, update } = useEnvironments(projectId);
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Environment | undefined>();
  const open = (environment?: Environment) => {
    setEditing(environment);
    dialog.current?.showModal();
  };
  const save = (body: never) =>
    editing ? update.mutateAsync({ id: editing.id, body }) : create.mutateAsync(body);
  const add = (
    <Button onClick={() => open()}>
      <Plus aria-hidden="true" className="size-4" />
      {t("env.add")}
    </Button>
  );
  const title = editing ? t("env.edit", { name: editing.name }) : t("env.add");
  return (
    <Card labelledBy="env-title">
      <CardHeader id="env-title" icon={Layers} title={t("settings.environments")} action={add} />
      <QueryBlock query={list} skeleton="h-40">
        {(data) =>
          data.environments.length === 0 ? (
            <StatePanel icon={Layers} title={t("env.none.title")} body={t("env.none.body")} />
          ) : (
            <ul className="flex flex-col">
              {data.environments.map((env) => (
                <EnvironmentRow key={env.id} environment={env} onEdit={() => open(env)} />
              ))}
            </ul>
          )
        }
      </QueryBlock>
      <Dialog ref={dialog} title={title} closeLabel={t("more.close")}>
        <EnvironmentForm
          key={editing?.id ?? "new"}
          environment={editing}
          onSave={save}
          onDone={() => {
            dialog.current?.close();
            notify(t("settings.saved"));
          }}
        />
      </Dialog>
    </Card>
  );
}
