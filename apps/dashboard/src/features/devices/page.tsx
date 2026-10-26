import { DEVICE_DIMENSIONS } from "@didban/contracts";
import { MonitorSmartphone } from "lucide-react";
import { useLocale } from "../../shared/lib/locale-context";
import { DimensionReport } from "../report/dimension-report";

/** Devices (spec §3.1): browser, OS, device type, screen class and language. */
export function DevicesPage() {
  const { t } = useLocale();
  return (
    <DimensionReport
      report="devices"
      title={t("nav.devices")}
      icon={MonitorSmartphone}
      choices={DEVICE_DIMENSIONS}
      rows="event"
    />
  );
}
