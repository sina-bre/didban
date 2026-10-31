import type { Environment } from "@didban/contracts";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, StatePanel, useToast } from "../../shared/ui";
import { useEnvironments } from "../environments/use-environments";
import { failureText } from "../settings/failure-text";
import type { Cause } from "./likely-cause";

interface Props {
  projectId: string;
  environment: Environment;
  /** `null`: nothing was rejected either. */
  cause: Cause | null;
  onFixed: () => void;
}

/** "Events rejected with ORIGIN_NOT_ALLOWED from https://…", with a button that allows it. */
export function CauseNotice({ projectId, environment, cause, onFixed }: Props) {
  const { t } = useLocale();
  const notify = useToast();
  const { update } = useEnvironments(projectId);
  const [error, setError] = useState<string | null>(null);
  if (!cause)
    return (
      <StatePanel icon={TriangleAlert} title={t("live.nothing")} body={t("live.nothingBody")} />
    );
  const origin = cause.code === "ORIGIN_NOT_ALLOWED" ? cause.origin : null;
  const allow = async (value: string) => {
    try {
      const allowedOrigins = [...environment.allowedOrigins, value];
      await update.mutateAsync({ id: environment.id, body: { allowedOrigins } });
      notify(t("live.originAdded", { origin: value }));
      onFixed();
    } catch (failure) {
      setError(failureText(t, failure));
    }
  };
  const title = origin
    ? t("live.rejectedFrom", { code: cause.code, origin })
    : t("live.rejected", { code: cause.code });
  return (
    <StatePanel role="alert" icon={TriangleAlert} title={title} body={t("live.hint")}>
      {origin && (
        <Button variant="primary" disabled={update.isPending} onClick={() => void allow(origin)}>
          {t("live.allowOrigin", { origin })}
        </Button>
      )}
      {error && <p className="text-body text-down">{error}</p>}
    </StatePanel>
  );
}
