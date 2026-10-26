import { useSearchParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Switch } from "../../shared/ui";
import { readCompare } from "../report/use-stats";

/** Comparison on/off, kept in the URL with the range and filters. */
export function CompareSwitch() {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const toggle = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set("compare", "previous_period");
    else next.delete("compare");
    setParams(next);
  };
  return (
    <Switch
      label={t("overview.compare")}
      checked={readCompare(params) !== "none"}
      onChange={toggle}
    />
  );
}
