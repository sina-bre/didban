import type { ShareLink } from "@didban/contracts";
import { ConfirmAction } from "../../shared/components";
import { formatInstant } from "../../shared/lib/format-instant";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable, Tag } from "../../shared/ui";
import { failureText } from "../settings/failure-text";

interface Props {
  links: readonly ShareLink[];
  onRevoke: (link: ShareLink) => Promise<unknown>;
}

const expired = (link: ShareLink) =>
  link.expiresAt !== null && Date.parse(link.expiresAt) <= Date.now();

/** Share links by label with expiry and state; active ones can be revoked. */
export function SharesTable({ links, onRevoke }: Props) {
  const { t, locale } = useLocale();
  const columns: Column<ShareLink>[] = [
    { key: "label", header: t("share.label"), cell: (l) => l.label },
    {
      key: "created",
      header: t("keys.createdAt"),
      cell: (l) => formatInstant(locale, l.createdAt),
    },
    {
      key: "expires",
      header: t("share.expires"),
      cell: (l) => (l.expiresAt ? formatInstant(locale, l.expiresAt) : t("share.never")),
    },
    {
      key: "state",
      header: t("keys.state"),
      cell: (l) => {
        if (l.revokedAt) return <Tag tone="down">{t("keys.revoked")}</Tag>;
        if (expired(l)) return <Tag>{t("share.expired")}</Tag>;
        return (
          <ConfirmAction
            label={t("keys.revoke")}
            name={t("share.revokeName", { label: l.label })}
            title={t("share.revokeTitle", { label: l.label })}
            body={t("share.revokeBody")}
            confirm={t("keys.revoke")}
            onConfirm={() => onRevoke(l)}
            failure={(error) => failureText(t, error)}
          />
        );
      },
    },
  ];
  return (
    <DataTable
      caption={t("settings.sharing")}
      columns={columns}
      rows={links}
      rowKey={(l) => l.id}
    />
  );
}
