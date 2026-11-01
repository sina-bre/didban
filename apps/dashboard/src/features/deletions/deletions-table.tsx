import type { DataDeletion } from "@didban/contracts";
import { formatNumber } from "../../shared/lib/format";
import { formatInstant } from "../../shared/lib/format-instant";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable, Tag } from "../../shared/ui";

const TONE = { pending: "neutral", running: "neutral", done: "neutral", failed: "down" } as const;

/** Requests newest first: what, when, state and how many rows are gone so far. */
export function DeletionsTable({ deletions }: { deletions: readonly DataDeletion[] }) {
  const { t, locale } = useLocale();
  const target = (d: DataDeletion) => {
    if (d.kind === "visitor") return t("deletion.visitorTarget");
    if (d.kind === "user") return <bdi dir="ltr">{d.userId}</bdi>;
    return `${formatInstant(locale, d.from)} – ${formatInstant(locale, d.to)}`;
  };
  const columns: Column<DataDeletion>[] = [
    { key: "kind", header: t("deletion.kind"), cell: (d) => t(`deletion.kind.${d.kind}`) },
    { key: "what", header: t("deletion.what"), cell: target },
    {
      key: "requested",
      header: t("deletion.requested"),
      cell: (d) => formatInstant(locale, d.createdAt),
    },
    {
      key: "status",
      header: t("deletion.status"),
      cell: (d) => <Tag tone={TONE[d.status]}>{t(`deletion.status.${d.status}`)}</Tag>,
    },
    {
      key: "deleted",
      header: t("deletion.deleted"),
      cell: (d) =>
        t("deletion.counts", {
          events: formatNumber(locale, d.eventsDeleted),
          visits: formatNumber(locale, d.visitsDeleted),
        }),
    },
  ];
  return (
    <DataTable
      caption={t("deletion.title")}
      columns={columns}
      rows={deletions}
      rowKey={(d) => d.id}
    />
  );
}
