import type { Config } from "./config.js";
import type { Store } from "./storage.js";
import type { Consent } from "./types.js";

const OPT_OUT_KEY = "didban_opt_out";

/** `send`: deliver; `hold`: keep in the bounded queue until consent; `drop`: discard. */
export type Decision = "send" | "hold" | "drop";

export interface Privacy {
  decision(): Decision;
  setConsent(consent: Consent): void;
  optOut(): void;
  optIn(): void;
  /** `?no_track=1` on any page sets the opt-out (feature catalog §23.1). */
  readOptOutLink(): void;
}

function browserSignalsBlock(config: Config): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (config.respectGpc && nav.globalPrivacyControl === true) return true;
  const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack;
  return config.respectDnt && dnt === "1";
}

/** `onChange` runs after consent or opt-out changes so held events can be sent or dropped. */
export function createPrivacy(config: Config, store: Store, onChange: () => void): Privacy {
  let consent: Consent | "pending" = config.requireConsent ? "pending" : "granted";
  let signals: boolean | undefined;
  return {
    decision() {
      signals ??= browserSignalsBlock(config);
      if (signals || consent === "denied" || store.get(OPT_OUT_KEY) === "1") return "drop";
      return consent === "pending" ? "hold" : "send";
    },
    setConsent(value) {
      if (value === "granted" || value === "denied") consent = value;
      onChange();
    },
    optOut() {
      store.set(OPT_OUT_KEY, "1");
      onChange();
    },
    optIn() {
      store.remove(OPT_OUT_KEY);
      onChange();
    },
    readOptOutLink() {
      if (new URLSearchParams(window.location.search).get("no_track") === "1") {
        store.set(OPT_OUT_KEY, "1");
      }
    },
  };
}
