// Project list, Overview and Realtime messages (spread into `en`, ADR 0005).
const enReports = {
  "projects.none.title": "No projects yet",
  "projects.none.body": "You cannot see any project yet. Ask an owner or admin to give you access.",
  "projects.empty.title": "No projects yet",
  "projects.empty.body": "Your organization has no projects yet.",
  "metric.visitors": "Visitors",
  "metric.visits": "Visits",
  "metric.pageviews": "Page views",
  "metric.viewsPerVisit": "Views per visit",
  "metric.bounceRate": "Bounce rate",
  "metric.visitDuration": "Visit duration",
  "overview.kpis": "Key metrics",
  "overview.chart": "Visitors over time",
  "overview.compare": "Compare with previous period",
  "overview.channels": "Channels",
  "overview.cookieless":
    "Cookieless mode: a visitor who returns on another day is counted again, so multi-day visitor totals run high.",
  "realtime.active": "Active visitors",
  "realtime.activeHint": "Last 5 minutes · updates every 10 seconds",
  "realtime.perMinute": "Page views per minute, last 30 minutes",
  "realtime.pages": "Active pages",
  "realtime.sources": "Top sources",
  "realtime.recent": "Recent events",
  "realtime.time": "Time",
  "realtime.event": "Event",
  "realtime.path": "Page",
  "realtime.visitors": "Visitors",
  "realtime.visits": "Visits",
  "realtime.pageview": "Page view",
  "realtime.none": "Nothing in the last 30 minutes.",
} as const;

export default enReports;
