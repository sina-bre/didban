import type { GoalStats } from "@didban/contracts";
import { formatNumber, formatPercent } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable } from "../../shared/ui";
import { DeleteGoal } from "./delete-goal";

interface Props {
  goals: readonly GoalStats[];
  /** Shows the delete column (project managers only). */
  onDelete?: (goal: GoalStats) => Promise<unknown>;
}

/** Revenue per currency (never summed across currencies, catalog 23.2). */
function revenue(locale: string, list: GoalStats["revenue"]): string {
  if (list.length === 0) return "—";
  return list
    .map(({ currency, amount }) =>
      new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount)),
    )
    .join(" · ");
}

/** Goals with conversions, converting visitors, browser-only conversion rate and revenue. */
export function GoalsTable({ goals, onDelete }: Props) {
  const { t, locale } = useLocale();
  const columns: Column<GoalStats>[] = [
    {
      key: "name",
      header: t("goals.name"),
      cell: (g) => (
        <span className="flex flex-col">
          {g.name}
          <bdi dir="ltr" className="text-caption text-muted">
            {g.kind === "event" ? g.eventName : g.pathPattern}
          </bdi>
        </span>
      ),
    },
    {
      key: "conversions",
      header: t("goals.conversions"),
      numeric: true,
      cell: (g) => <bdi>{formatNumber(locale, g.conversions)}</bdi>,
    },
    {
      key: "visitors",
      header: t("metric.visitors"),
      numeric: true,
      cell: (g) => <bdi>{formatNumber(locale, g.visitors)}</bdi>,
    },
    {
      key: "rate",
      header: t("goals.rate"),
      numeric: true,
      cell: (g) => (
        <bdi>{g.conversionRate === null ? "—" : formatPercent(locale, g.conversionRate)}</bdi>
      ),
    },
    {
      key: "revenue",
      header: t("goals.revenue"),
      numeric: true,
      cell: (g) => <bdi>{revenue(locale, g.revenue)}</bdi>,
    },
  ];
  if (onDelete) {
    columns.push({
      key: "delete",
      header: t("goals.actions"),
      cell: (g) => <DeleteGoal goal={g} onDelete={onDelete} />,
    });
  }
  return <DataTable caption={t("nav.goals")} columns={columns} rows={goals} rowKey={(g) => g.id} />;
}
