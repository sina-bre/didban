import type { DiscoveredPageRow } from "@didban/contracts";
import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import { EmptyState } from "../../shared/components";
import { formatBucket } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, type Column, DataTable } from "../../shared/ui";
import { useProject } from "../projects/use-project";
import { ExportLink } from "../report/export-link";
import { QueryBlock } from "../report/query-block";
import { useBreakdown } from "../report/use-breakdown";

/** Routes first seen in the range (spec §3.1): only routes that received traffic, newest first. */
export function DiscoveredPages({ controls }: { controls: ReactNode }) {
  const { t, locale } = useLocale();
  const timeZone = useProject(useParams().projectId ?? "").data?.reportingTimezone ?? "UTC";
  const query = useBreakdown<DiscoveredPageRow>("pages", { view: "discovered" });
  const day = (iso: string) => formatBucket(locale, new Date(iso), false, timeZone);
  const title = t("pages.view.discovered");
  const columns: Column<DiscoveredPageRow>[] = [
    {
      key: "route",
      header: t("field.route"),
      cell: (row) => (
        <span className="flex flex-col">
          <bdi dir="ltr">{row.route}</bdi>
          <span className="text-caption text-muted">{row.hostname}</span>
        </span>
      ),
    },
    { key: "title", header: t("pages.lastTitle"), cell: (row) => row.lastTitle ?? "—" },
    { key: "first", header: t("pages.firstSeen"), numeric: true, cell: (r) => day(r.firstSeenAt) },
    { key: "last", header: t("pages.lastSeen"), numeric: true, cell: (r) => day(r.lastSeenAt) },
  ];
  return (
    <Card labelledBy="pages-title">
      <CardHeader
        id="pages-title"
        icon={Compass}
        title={title}
        action={<ExportLink report="pages" params={{ view: "discovered" }} />}
      />
      <div className="mb-3">{controls}</div>
      <QueryBlock query={query} skeleton="h-96">
        {(data) =>
          data.rows.length === 0 ? (
            <EmptyState />
          ) : (
            <DataTable
              caption={title}
              columns={columns}
              rows={data.rows}
              rowKey={(r) => `${r.hostname}${r.route}`}
            />
          )
        }
      </QueryBlock>
    </Card>
  );
}
