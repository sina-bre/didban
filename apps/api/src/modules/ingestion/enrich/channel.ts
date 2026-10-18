import { readFileSync } from "node:fs";
import { CHANNELS, type Channel } from "@didban/contracts";
import type { SourceType } from "./referrer.js";

// Spec §4 channel grouping; the rule tables live in data/channels.json (ADR 0026).

type ChannelName = keyof typeof CHANNELS;
type Rules = { mediums: Record<string, ChannelName>; sourceTypes: Record<SourceType, ChannelName> };

const FILE = new URL("../../../../data/channels.json", import.meta.url);
const rules = JSON.parse(readFileSync(FILE, "utf8")) as Rules;

export type ChannelInput = {
  utmMedium: string | null;
  hasUtm: boolean;
  /** `undefined` = no referrer; `null` = an external referrer we do not know. */
  referrerType: SourceType | null | undefined;
};

export function classifyChannel(input: ChannelInput): Channel {
  const byMedium = input.utmMedium ? rules.mediums[input.utmMedium.toLowerCase()] : undefined;
  if (byMedium) return CHANNELS[byMedium];
  if (input.referrerType) return CHANNELS[rules.sourceTypes[input.referrerType]];
  if (input.referrerType === null || input.hasUtm) return CHANNELS.referral;
  return CHANNELS.direct;
}
