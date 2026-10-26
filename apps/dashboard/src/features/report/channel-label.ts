import { CHANNELS } from "@didban/contracts";
import type { MessageKey, Translate } from "../../shared/lib/i18n";

const isChannel = (value: string | null): value is keyof typeof CHANNELS =>
  value !== null && Object.hasOwn(CHANNELS, value);

/** The API's channel name (`organicSearch`) in the user's words; unknown values as sent. */
export function channelLabel(t: Translate, value: string | null): string {
  if (isChannel(value)) return t(`channel.${CHANNELS[value]}` as MessageKey);
  return value ?? "—";
}
