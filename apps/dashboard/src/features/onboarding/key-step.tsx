import type { CreatedApiKey, Environment } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { Button } from "../../shared/ui";
import { IntegrationPanel } from "../integration/integration-panel";
import { useKeys } from "../keys/use-keys";
import { failureText } from "../settings/failure-text";

interface Props {
  projectId: string;
  environment: Environment;
  created: CreatedApiKey | null;
  onCreated: (key: CreatedApiKey) => void;
  onNext: () => void;
}

/** Step 3: a browser write key for the new environment, then its snippets (shown once). */
export function KeyStep({ projectId, environment, created, onCreated, onNext }: Props) {
  const { t } = useLocale();
  const { create } = useKeys(projectId);
  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <IntegrationPanel kind={created.kind} token={created.token} />
        <Button variant="primary" className="self-start" onClick={onNext}>
          {t("wizard.installed")}
        </Button>
      </div>
    );
  }
  const run = () =>
    create.mutate(
      { environmentId: environment.id, kind: "write_browser" },
      { onSuccess: onCreated },
    );
  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <p className="text-body text-muted">{t("wizard.keyIntro")}</p>
      {create.isError && (
        <p role="alert" className="text-body text-down">
          {failureText(t, create.error)}
        </p>
      )}
      <Button variant="primary" disabled={create.isPending} onClick={run}>
        {t("wizard.createKey")}
      </Button>
    </div>
  );
}
