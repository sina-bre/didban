import type { AuditEntry } from "@didban/contracts";
import { formatInstant } from "../../shared/lib/format-instant";
import type { MessageKey } from "../../shared/lib/i18n";
import { useLocale } from "../../shared/lib/locale-context";
import type { Column } from "../../shared/ui";

/** Field names and values the server recorded (never secrets, spec §11), as `key: value`. */
const details = (entry: AuditEntry) =>
  Object.entries(entry.details)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");

/** When, who, what, on what, details, from where. */
export function useAuditColumns(): Column<AuditEntry>[] {
  const { t, locale } = useLocale();
  const ltr = (text: string) => <bdi dir="ltr">{text}</bdi>;
  return [
    {
      key: "at",
      header: t("audit.at"),
      cell: (e) => <bdi>{formatInstant(locale, e.createdAt)}</bdi>,
    },
    {
      key: "actor",
      header: t("audit.actor"),
      cell: (e) => ltr(e.actor?.email ?? t("audit.system")),
    },
    { key: "action", header: t("audit.action"), cell: (e) => t(`audit.${e.action}` as MessageKey) },
    {
      key: "target",
      header: t("audit.target"),
      cell: (e) => (e.target ? t(`audit.type.${e.target.type}` as MessageKey) : "—"),
    },
    { key: "details", header: t("audit.details"), cell: (e) => ltr(details(e)) },
    { key: "ip", header: t("audit.ip"), cell: (e) => ltr(e.ipPrefix ?? "—") },
  ];
}
