import type { Environment } from "@didban/contracts";
import { CircleCheck, Radio, SearchCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { StatePanel } from "../../shared/ui";
import { CauseNotice } from "./cause-notice";
import { useLiveCheck } from "./use-live-check";

interface Props {
  projectId: string;
  environment: Environment;
}

/** Spec §13.4 live check: waiting → first event received, or the likely cause with a fix. */
export function LiveCheck({ projectId, environment }: Props) {
  const { t } = useLocale();
  const check = useLiveCheck(projectId, environment.id);
  let content: ReactNode;
  if (check.received) {
    content = (
      <StatePanel icon={CircleCheck} title={t("live.received")} body={t("live.receivedBody")}>
        <Link
          className="font-medium text-accent-text underline"
          to={`/projects/${projectId}/realtime`}
        >
          {t("live.openRealtime")}
        </Link>
      </StatePanel>
    );
  } else if (!check.timedOut) {
    content = <StatePanel icon={Radio} title={t("live.waiting")} body={t("live.waitingBody")} />;
  } else if (check.cause === undefined) {
    content = (
      <StatePanel icon={SearchCheck} title={t("live.checking")} body={t("live.waitingBody")} />
    );
  } else {
    content = (
      <CauseNotice
        projectId={projectId}
        environment={environment}
        cause={check.cause}
        onFixed={check.restart}
      />
    );
  }
  return (
    <section role="status" aria-label={t("live.title")} className="rounded-panel bg-subtle">
      {content}
    </section>
  );
}
