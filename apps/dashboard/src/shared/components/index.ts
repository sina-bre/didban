// Domain wrappers over shared/ui (spec §13.2.4). Feature code imports UI from here and shared/ui.
// ConsentBanner is for the example app only and lives there, not in the dashboard.
export {
  type BreakdownMetric,
  type BreakdownRow,
  BreakdownTable,
  type MetricKind,
} from "./breakdown-table";
export { ChannelBadge, type ChannelCode } from "./channel-badge";
export { ConfirmAction } from "./confirm-action";
export { DateRangePicker } from "./date-range-picker";
export { EmptyState } from "./empty-state";
export { ErrorState } from "./error-state";
export { type Filter, FilterBar } from "./filter-bar";
export { OrgProjectSwitcher, type SwitcherOrg } from "./org-project-switcher";
export { PermissionDenied } from "./permission-denied";
export { SecretOnce } from "./secret-once";
export { SeriesSummary, type SeriesTotal } from "./series-summary";
export { ShareBars, type ShareRow } from "./share-bars";
export { StatCard } from "./stat-card";
export { type SeriesPoint, TimeSeriesChart } from "./time-series-chart";
