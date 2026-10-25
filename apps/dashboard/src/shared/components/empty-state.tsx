import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "../lib/locale-context";
import { StatePanel } from "../ui";

interface Props {
  /** The integration snippet link (spec §13.4), added by the report once projects load. */
  action?: ReactNode;
}

/** "No data yet" for a report with no events in the range. */
export function EmptyState({ action }: Props) {
  const { t } = useLocale();
  return (
    <StatePanel icon={Inbox} title={t("state.empty.title")} body={t("state.empty.body")}>
      {action}
    </StatePanel>
  );
}
