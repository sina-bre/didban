import { SOURCE_DIMENSIONS } from "@didban/contracts";
import { Share2 } from "lucide-react";
import { useLocale } from "../../shared/lib/locale-context";
import { DimensionReport } from "../report/dimension-report";

/** Sources (spec §3.1): channels, referrers and UTM values of each visit's first touch. */
export function SourcesPage() {
  const { t } = useLocale();
  const choices = ["channel", ...SOURCE_DIMENSIONS.filter((d) => d !== "channel")] as const;
  return (
    <DimensionReport
      report="sources"
      title={t("nav.sources")}
      icon={Share2}
      choices={choices}
      rows="visit"
    />
  );
}
