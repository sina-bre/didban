import type { QueryClient } from "@tanstack/react-query";
import { meQuery } from "../features/auth/use-me";
import { overviewQueries } from "../features/overview/use-overview";
import { projectQuery } from "../features/projects/use-project";
import { reportContext, statsQuery } from "../features/report/use-stats";

// The first screen's reads start while the code and messages still load, not after the shell has
// rendered (Lighthouse mobile, Stage 5f: that chain cost LCP several round trips). Same query keys
// as the hooks, so they find the answers in the cache.
const PUBLIC = ["/login", "/set-password", "/share"];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PROJECT = new RegExp(`^/projects/(${UUID})(/overview)?/?$|^/projects/(${UUID})/`, "i");

/** Overview is a project's landing page: its three reports once the reporting zone is known. */
async function prefetchOverview(client: QueryClient, projectId: string, search: string) {
  const project = await client.fetchQuery(projectQuery(projectId));
  const context = reportContext(projectId, new URLSearchParams(search), project.reportingTimezone);
  for (const [report, query] of Object.entries(overviewQueries(context))) {
    void client.prefetchQuery(statsQuery(projectId, report, query));
  }
}

export function prefetchFirstScreen(client: QueryClient, { pathname, search }: Location): void {
  if (PUBLIC.some((path) => pathname.startsWith(path))) return; // no session to ask about
  void client.prefetchQuery(meQuery);
  const match = PROJECT.exec(pathname);
  const overviewId = match?.[1];
  const projectId = overviewId ?? match?.[3];
  if (overviewId) prefetchOverview(client, overviewId, search).catch(() => undefined);
  else if (projectId) void client.prefetchQuery(projectQuery(projectId));
}
