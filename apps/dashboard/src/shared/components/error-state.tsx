import { TriangleAlert } from "lucide-react";
import { useLocale } from "../lib/locale-context";
import { Button, StatePanel } from "../ui";

interface Props {
  /** `X-Request-Id` of the failed call, so a report can be matched to the API logs (spec §13.4). */
  requestId?: string;
  onRetry?: () => void;
}

/** Failed request: announced, shows the request ID (selectable, LTR) and a retry button. */
export function ErrorState({ requestId, onRetry }: Props) {
  const { t } = useLocale();
  return (
    <StatePanel
      role="alert"
      icon={TriangleAlert}
      title={t("state.error.title")}
      body={t("state.error.body")}
    >
      {requestId && (
        <p className="text-caption text-muted">
          {t("state.error.requestId")}:{" "}
          <code dir="ltr" className="select-all">
            {requestId}
          </code>
        </p>
      )}
      {onRetry && <Button onClick={onRetry}>{t("state.error.retry")}</Button>}
    </StatePanel>
  );
}
