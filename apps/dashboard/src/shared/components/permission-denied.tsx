import { Lock } from "lucide-react";
import { useLocale } from "../lib/locale-context";
import { StatePanel } from "../ui";

/** 403 inside a page the user can open but not fully use (spec §13.4). */
export function PermissionDenied() {
  const { t } = useLocale();
  return <StatePanel icon={Lock} title={t("state.denied.title")} body={t("state.denied.body")} />;
}
