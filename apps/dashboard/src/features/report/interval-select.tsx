import { useSearchParams } from "react-router";
import { type IntervalChoice, intervalChoices } from "../../shared/lib/interval";
import { useLocale } from "../../shared/lib/locale-context";
import { Segmented } from "../../shared/ui";

interface Props {
  /** Length of the current range in days: decides which intervals are offered. */
  days: number;
  value: IntervalChoice;
}

/** Time-series interval (spec §13.4), in the URL as `?interval=`; `auto` is the absent default. */
export function IntervalSelect({ days, value }: Props) {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const options = intervalChoices(days).map((choice) => ({
    value: choice,
    label: t(`interval.${choice}`),
  }));
  const choose = (choice: IntervalChoice) => {
    const next = new URLSearchParams(params);
    if (choice === "auto") next.delete("interval");
    else next.set("interval", choice);
    setParams(next);
  };
  return (
    <Segmented label={t("interval.label")} value={value} options={options} onChange={choose} />
  );
}
