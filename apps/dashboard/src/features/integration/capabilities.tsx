import type { MessageKey } from "../../shared/lib/i18n";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable } from "../../shared/ui";

/** Spec §3.4 rows, in its order: what installing the SDK collects, and what it never sees. */
const ROWS = [
  "pages",
  "spa",
  "utm",
  "device",
  "visitors",
  "clicks",
  "purchases",
  "backend",
  "unvisited",
  "private",
] as const;

type Row = (typeof ROWS)[number];

/** The capability table (spec §3.4) shown with every new key. */
export function Capabilities() {
  const { t } = useLocale();
  const columns: Column<Row>[] = [
    { key: "info", header: t("cap.info"), cell: (row) => t(`cap.${row}` as MessageKey) },
    {
      key: "collected",
      header: t("cap.collected"),
      cell: (row) => t(`cap.${row}.answer` as MessageKey),
    },
  ];
  return <DataTable caption={t("cap.title")} columns={columns} rows={ROWS} rowKey={(row) => row} />;
}
