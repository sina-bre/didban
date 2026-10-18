// The stats use cases explain-stats.mjs measures: the built API code and the contracts schemas,
// so the statements are exactly the ones production runs. Plans are captured for 90-day runs.
const dist = (file) =>
  import(new URL(`../../../apps/api/dist/modules/analytics/${file}.js`, import.meta.url));
const c = await import(new URL("../../../packages/contracts/dist/index.js", import.meta.url));
const [overview, timeseries, pages, sources, geo, events, detail, goals, realtime, health] =
  await Promise.all(
    [
      "overview",
      "timeseries",
      "pages",
      "sources",
      "geo-devices",
      "events-report",
      "page-detail",
      "goals-report",
      "realtime",
      "data-health",
    ].map(dist),
  );

const range = (days) => {
  const to = new Date();
  return { from: new Date(to.getTime() - days * 86_400_000).toISOString(), to: to.toISOString() };
};
/** A use case run: `get(sql, scope, { projectId, query })` with the endpoint's parsed query. */
const report = (name, schema, get, extra = {}, ranges = [90]) => ({
  name,
  ranges,
  run: (sql, scope, projectId, days) =>
    get(sql, scope, { projectId, query: schema.parse({ ...range(days), ...extra }) }),
});
const PAGE = "pathname:eq:/page/7";

export const CASES = [
  report(
    "overview + previous period",
    c.statsQuerySchema,
    overview.getOverview,
    { compare: "previous_period" },
    [7, 30, 90],
  ),
  report("overview, filter page", c.statsQuerySchema, overview.getOverview, { filter: PAGE }),
  report("overview, filter country + browser", c.statsQuerySchema, overview.getOverview, {
    filter: ["country:eq:DE", "browser:eq:Safari"],
  }),
  report("timeseries auto", c.statsQuerySchema, timeseries.getTimeseries, {}, [7, 30, 90]),
  report(
    "timeseries hourly",
    c.statsQuerySchema,
    timeseries.getTimeseries,
    { interval: "hour" },
    [7],
  ),
  report("pages top", c.pagesQuerySchema, pages.getPages, {}, [7, 90]),
  report("pages entry", c.pagesQuerySchema, pages.getPages, { view: "entry" }),
  report("pages discovered", c.pagesQuerySchema, pages.getPages, { view: "discovered" }),
  report("sources channel", c.sourcesQuerySchema, sources.getSources),
  report("sources utm_source, filter page", c.sourcesQuerySchema, sources.getSources, {
    by: "utm_source",
    filter: PAGE,
  }),
  report("geo country", c.geoQuerySchema, geo.getGeo),
  report("devices browser", c.devicesQuerySchema, geo.getDevices),
  report("events", c.eventsQuerySchema, events.getEvents),
  report("goals", c.statsQuerySchema, goals.getGoalStats),
  {
    name: "event properties (keys, then plan values)",
    ranges: [90],
    run: async (sql, scope, projectId, days) => {
      const query = (extra) => c.eventPropertiesQuerySchema.parse({ ...range(days), ...extra });
      await events.getEventProperties(sql, scope, { projectId, query: query({}), name: "signup" });
      await events.getEventProperties(sql, scope, {
        projectId,
        query: query({ key: "plan" }),
        name: "signup",
      });
    },
  },
  report("page detail /page/7", c.pageDetailQuerySchema, detail.getPageDetail, {
    hostname: "shop.example",
    route: "/page/7",
  }),
  {
    name: "realtime (30 min)",
    ranges: [90],
    run: (sql, scope, projectId) => realtime.getRealtime(sql, scope, { projectId, query: {} }),
  },
  {
    name: "data health (7 days)",
    ranges: [90],
    run: (sql, scope, projectId) =>
      health.getDataHealth(sql, scope, { projectId, query: {}, recent: { list: () => [] } }),
  },
];
