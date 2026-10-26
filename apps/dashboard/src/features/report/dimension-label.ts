import { DEVICE_TYPES, SCREEN_CLASSES } from "@didban/contracts";
import { displayName } from "../../shared/lib/display-name";
import type { Locale, MessageKey, Translate } from "../../shared/lib/i18n";
import { channelLabel } from "./channel-label";

// A stored dimension value in the user's words: the API sends names (`organicSearch`, `mobile`,
// `DE`); the dashboard labels them. Unknown values are shown as sent.
const DEVICES = new Set(Object.keys(DEVICE_TYPES));
const SCREENS = new Set<string>(SCREEN_CLASSES.map((s) => s.name));

interface Input {
  t: Translate;
  locale: Locale;
  field: string;
}

export function dimensionLabel({ t, locale, field }: Input, value: string | null): string {
  if (value === null) return t("value.none");
  if (field === "channel") return channelLabel(t, value);
  if (field === "country") return displayName(locale, "region", value);
  if (field === "language") return displayName(locale, "language", value);
  if (field === "device_type" && DEVICES.has(value)) return t(`device.${value}` as MessageKey);
  if (field === "screen" && SCREENS.has(value)) return t(`screen.${value}` as MessageKey);
  return value;
}
