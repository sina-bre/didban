import type { CreateDataDeletionRequest, Project } from "@didban/contracts";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, StatePanel } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { DeletionConfirm } from "./deletion-confirm";
import { DeletionForm } from "./deletion-form";
import { DeletionsTable } from "./deletions-table";
import { useDeletions } from "./use-deletions";

/** Spec §12 deletion by range, visitor or user ID: queued here, done by the job runner. */
export function DeletionsCard({ project }: { project: Project }) {
  const { t } = useLocale();
  const { list, create } = useDeletions(project.id);
  const dialog = useRef<HTMLDialogElement>(null);
  const [request, setRequest] = useState<CreateDataDeletionRequest | null>(null);
  const [formKey, setFormKey] = useState(0);
  const confirm = async () => {
    if (!request) return;
    await create.mutateAsync(request);
    setFormKey((key) => key + 1); // a fresh, empty form
    dialog.current?.close();
  };
  return (
    <Card labelledBy="deletion-title">
      <CardHeader id="deletion-title" icon={Trash2} title={t("deletion.title")} />
      <p className="mb-4 max-w-prose text-body text-muted">{t("deletion.intro")}</p>
      <QueryBlock query={list} skeleton="h-24">
        {(data) =>
          data.deletions.length === 0 ? (
            <StatePanel
              icon={Trash2}
              title={t("deletion.none.title")}
              body={t("deletion.none.body")}
            />
          ) : (
            <DeletionsTable deletions={data.deletions} />
          )
        }
      </QueryBlock>
      <DeletionForm
        key={formKey}
        timeZone={project.reportingTimezone}
        onRequest={(body) => {
          setRequest(body);
          dialog.current?.showModal();
        }}
      />
      <DeletionConfirm ref={dialog} onConfirm={confirm} onClose={() => setRequest(null)} />
    </Card>
  );
}
