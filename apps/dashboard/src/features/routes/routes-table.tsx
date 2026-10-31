import type { RouteTemplate } from "@didban/contracts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ConfirmAction } from "../../shared/components";
import { formatNumber } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, type Column, DataTable } from "../../shared/ui";
import { failureText } from "../settings/failure-text";

interface Props {
  routes: readonly RouteTemplate[];
  onMove: (route: RouteTemplate, position: number) => void;
  onDelete: (route: RouteTemplate) => Promise<unknown>;
}

/** Templates in match order (the first match wins), each movable by one place or deletable. */
export function RoutesTable({ routes, onMove, onDelete }: Props) {
  const { t, locale } = useLocale();
  const last = routes.length;
  const columns: Column<RouteTemplate>[] = [
    {
      key: "position",
      header: t("routes.position"),
      numeric: true,
      cell: (r) => formatNumber(locale, r.position),
    },
    { key: "pattern", header: t("routes.pattern"), cell: (r) => <bdi dir="ltr">{r.pattern}</bdi> },
    {
      key: "actions",
      header: t("goals.actions"),
      cell: (r) => (
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            aria-label={t("routes.up", { pattern: r.pattern })}
            disabled={r.position === 1}
            onClick={() => onMove(r, r.position - 1)}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            aria-label={t("routes.down", { pattern: r.pattern })}
            disabled={r.position === last}
            onClick={() => onMove(r, r.position + 1)}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </Button>
          <ConfirmAction
            label={t("routes.delete")}
            name={t("routes.deleteName", { pattern: r.pattern })}
            title={t("routes.deleteTitle", { pattern: r.pattern })}
            body={t("routes.deleteBody")}
            confirm={t("routes.delete")}
            onConfirm={() => onDelete(r)}
            failure={(error) => failureText(t, error)}
          />
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption={t("settings.routes")}
      columns={columns}
      rows={routes}
      rowKey={(r) => r.id}
    />
  );
}
