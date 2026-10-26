import { type BreakdownResponse, GEO_DIMENSIONS } from "@didban/contracts";
import { Globe, MapPinOff } from "lucide-react";
import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { StatePanel } from "../../shared/ui";
import { useProject } from "../projects/use-project";
import { DimensionReport } from "../report/dimension-report";

type Geo = (typeof GEO_DIMENSIONS)[number];

/**
 * Geo (spec §3.1): country, region, city. Locations need the server's GeoLite2 file; when every
 * row has none, the report says so instead of one "not recorded" row (spec §13.4).
 */
export function GeoPage() {
  const { t } = useLocale();
  const storeCity = useProject(useParams().projectId ?? "").data?.storeCity ?? false;
  const notice = (by: Geo, data: BreakdownResponse<{ value: string | null }>) => {
    if (by === "city" && !storeCity) {
      return (
        <StatePanel icon={MapPinOff} title={t("geo.cityOff.title")} body={t("geo.cityOff.body")} />
      );
    }
    if (data.rows.length === 0 || data.rows.some((row) => row.value !== null)) return null;
    return <StatePanel icon={MapPinOff} title={t("geo.off.title")} body={t("geo.off.body")} />;
  };
  return (
    <DimensionReport
      report="geo"
      title={t("nav.geo")}
      icon={Globe}
      choices={GEO_DIMENSIONS}
      rows="event"
      notice={notice}
    />
  );
}
