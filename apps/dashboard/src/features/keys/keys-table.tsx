import type { ApiKey } from "@didban/contracts";
import { ConfirmAction } from "../../shared/components";
import { formatInstant } from "../../shared/lib/format-instant";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable, Tag } from "../../shared/ui";
import { failureText } from "../settings/failure-text";

interface Props {
  keys: readonly ApiKey[];
  environmentName: (id: string) => string;
  onRevoke: (key: ApiKey) => Promise<unknown>;
}

/** Keys by prefix (the token itself is never stored), with use and revocation state. */
export function KeysTable({ keys, environmentName, onRevoke }: Props) {
  const { t, locale } = useLocale();
  const columns: Column<ApiKey>[] = [
    {
      key: "prefix",
      header: t("keys.prefix"),
      cell: (k) => (
        <bdi dir="ltr" className="font-mono text-caption">
          {k.prefix}…
        </bdi>
      ),
    },
    {
      key: "env",
      header: t("keys.environment"),
      cell: (k) => <bdi dir="ltr">{environmentName(k.environmentId)}</bdi>,
    },
    { key: "kind", header: t("keys.kind"), cell: (k) => t(`keys.kind.${k.kind}`) },
    {
      key: "created",
      header: t("keys.createdAt"),
      cell: (k) => formatInstant(locale, k.createdAt),
    },
    { key: "used", header: t("keys.lastUsed"), cell: (k) => formatInstant(locale, k.lastUsedAt) },
    {
      key: "state",
      header: t("keys.state"),
      cell: (k) =>
        k.revokedAt ? (
          <Tag tone="down">{t("keys.revoked")}</Tag>
        ) : (
          <ConfirmAction
            label={t("keys.revoke")}
            name={t("keys.revokeName", { prefix: k.prefix })}
            title={t("keys.revokeTitle", { prefix: k.prefix })}
            body={t("keys.revokeBody")}
            confirm={t("keys.revoke")}
            onConfirm={() => onRevoke(k)}
            failure={(error) => failureText(t, error)}
          />
        ),
    },
  ];
  return (
    <DataTable caption={t("settings.keys")} columns={columns} rows={keys} rowKey={(k) => k.id} />
  );
}
