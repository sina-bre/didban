import type { Config } from "./config.js";
import { uuidv7 } from "./ids.js";
import { MAX_ID_LENGTH } from "./limits.js";
import type { Store } from "./storage.js";

const ANONYMOUS_ID_KEY = "didban_aid";

export interface Identity {
  fields(): { anonymousId?: string; userId?: string };
  setUserId(userId: string): void;
  reset(): void;
}

/**
 * `cookieless`: no stable ID leaves the browser and nothing is stored (no shared state between
 * tabs). `persistent`: one `anonymousId` in storage, read on every event so all tabs share it.
 * `userId` lives in memory for this instance only (spec §8.3 `identify`).
 */
export function createIdentity(mode: Config["identity"], store: Store): Identity {
  let userId: string | undefined;
  const anonymousId = (): string | undefined => {
    if (mode !== "persistent") return undefined;
    const stored = store.get(ANONYMOUS_ID_KEY);
    if (stored && stored.length <= MAX_ID_LENGTH) return stored;
    const fresh = uuidv7();
    store.set(ANONYMOUS_ID_KEY, fresh);
    return fresh;
  };
  return {
    fields() {
      const id = anonymousId();
      return { ...(id ? { anonymousId: id } : {}), ...(userId ? { userId } : {}) };
    },
    setUserId(id) {
      userId = id;
    },
    reset() {
      userId = undefined;
      if (mode === "persistent") store.set(ANONYMOUS_ID_KEY, uuidv7());
    },
  };
}
