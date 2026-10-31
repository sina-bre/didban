import { useLocale } from "../../shared/lib/locale-context";
import { SelectField } from "../../shared/ui";

/** IANA zones of this browser's Intl data, UTC first (the API checks the name again). */
const zones = (current: string) => {
  const all = ["UTC", ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "UTC")];
  return all.includes(current) ? all : [current, ...all];
};

/** The reporting time zone: days, weeks and months of every report are cut in it. */
export function TimeZoneField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  const { t } = useLocale();
  return (
    <SelectField
      label={t("settings.timezone")}
      hint={t("settings.timezoneHint")}
      name="reportingTimezone"
      defaultValue={defaultValue}
      error={error}
      dir="ltr"
    >
      {zones(defaultValue).map((zone) => (
        <option key={zone} value={zone}>
          {zone}
        </option>
      ))}
    </SelectField>
  );
}
