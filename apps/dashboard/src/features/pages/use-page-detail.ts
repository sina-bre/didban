import type { PageDetailResponse } from "@didban/contracts";
import { useSearchParams } from "react-router";
import { useBreakdownQuery, useStats } from "../report/use-stats";

/** `GET …/stats/pages/detail?hostname=&route=` for the page named in the URL. */
export function usePageDetail() {
  const [params] = useSearchParams();
  const hostname = params.get("hostname") ?? "";
  const route = params.get("route") ?? "";
  const { projectId, query } = useBreakdownQuery();
  const detail = useStats<PageDetailResponse>(
    projectId,
    "pages/detail",
    { ...query, hostname, route },
    hostname !== "" && route !== "",
  );
  return { projectId, hostname, route, detail };
}
