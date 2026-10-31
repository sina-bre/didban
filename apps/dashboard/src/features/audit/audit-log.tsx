import { ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { ErrorState } from "../../shared/components";
import { ApiError } from "../../shared/lib/api-client";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Card, CardHeader, DataTable, Skeleton, StatePanel } from "../../shared/ui";
import { useAuditColumns } from "./audit-columns";
import { useAuditLog } from "./use-audit-log";

interface Props {
  organizationId: string;
  projectId?: string;
}

/** Read-only audit log viewer (spec §11), newest first, older pages on request. */
export function AuditLog({ organizationId, projectId }: Props) {
  const { t } = useLocale();
  const log = useAuditLog(organizationId, projectId);
  const columns = useAuditColumns();
  const entries = log.data?.pages.flatMap((page) => page.entries) ?? [];
  let body: ReactNode;
  if (log.isPending) body = <Skeleton className="h-72" />;
  else if (log.isError && entries.length === 0) {
    const requestId = log.error instanceof ApiError ? log.error.requestId : undefined;
    body = <ErrorState requestId={requestId} onRetry={() => void log.refetch()} />;
  } else if (entries.length === 0) {
    body = (
      <StatePanel icon={ScrollText} title={t("audit.none.title")} body={t("audit.none.body")} />
    );
  } else {
    body = (
      <DataTable
        caption={t("settings.audit")}
        columns={columns}
        rows={entries}
        rowKey={(e) => e.id}
      />
    );
  }
  return (
    <Card labelledBy="audit-title">
      <CardHeader id="audit-title" icon={ScrollText} title={t("settings.audit")} />
      {body}
      {log.hasNextPage && (
        <Button
          className="mt-4"
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
        >
          {t("audit.more")}
        </Button>
      )}
    </Card>
  );
}
